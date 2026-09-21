import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import { tariffs, subscriptions, payments, paymentWebhookEvents, masters } from '@beauty/db';
import type { TariffCode } from '@beauty/contracts';
import { APP_ENV, DB } from '../common/tokens';
import {
  NoopPaymentProvider,
  YooKassaPaymentProvider,
  type PaymentProvider,
} from './payment-provider';

const PERIOD_DAYS = 30;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly provider: PaymentProvider;

  constructor(
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
  ) {
    if (this.env.PAYMENTS_ENABLED && this.env.YOOKASSA_SHOP_ID && this.env.YOOKASSA_SECRET_KEY) {
      this.provider = new YooKassaPaymentProvider(
        this.env.YOOKASSA_SHOP_ID,
        this.env.YOOKASSA_SECRET_KEY,
        this.env.YOOKASSA_WEBHOOK_SECRET,
      );
    } else {
      this.provider = new NoopPaymentProvider();
    }
  }

  /**
   * Starts a checkout. No subscription row is created here — an unpaid intent must
   * never grant entitlements, so the subscription is only written once the provider
   * confirms the payment in `handleWebhook`.
   */
  async subscribe(masterId: string, tariffCode: TariffCode, returnUrl?: string) {
    if (!this.env.PAYMENTS_ENABLED) {
      throw new ServiceUnavailableException({
        error: { code: 'PAYMENTS_DISABLED', message: 'Payments are not enabled' },
      });
    }

    const [tariff] = await this.db
      .select()
      .from(tariffs)
      .where(and(eq(tariffs.code, tariffCode), eq(tariffs.isActive, true)))
      .limit(1);
    if (!tariff) {
      throw new BadRequestException({
        error: { code: 'TARIFF_NOT_FOUND', message: 'Tariff not found' },
      });
    }

    // Server-side price only — the client never supplies an amount
    const amount = Number.parseInt(tariff.priceAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException({
        error: { code: 'BAD_PRICE', message: 'Tariff price misconfigured' },
      });
    }

    const [active] = await this.db
      .select({ id: subscriptions.id, tariffCode: subscriptions.tariffCode })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.masterId, masterId),
          eq(subscriptions.status, 'active'),
          gt(subscriptions.currentPeriodEnd, new Date()),
        ),
      )
      .limit(1);
    if (active && active.tariffCode === tariffCode) {
      throw new ConflictException({
        error: {
          code: 'ALREADY_SUBSCRIBED',
          message: 'An active subscription for this tariff already exists',
        },
      });
    }

    const paymentId = randomUUID();
    const created = await this.provider.createPayment({
      amount,
      currency: 'RUB',
      description: `Beauty+ ${tariffCode}`,
      returnUrl: returnUrl ?? this.env.PUBLIC_MINIAPP_URL,
      metadata: { masterId, paymentId, tariffCode },
      idempotenceKey: paymentId,
    });

    await this.db.insert(payments).values({
      id: paymentId,
      masterId,
      amount,
      currency: 'RUB',
      status: 'pending',
      provider: 'yookassa',
      providerPaymentId: created.providerPaymentId,
      description: `Beauty+ ${tariffCode}`,
      metadata: { tariffCode },
    });

    return {
      paymentId,
      confirmationUrl: created.confirmationUrl,
      amount,
      currency: 'RUB' as const,
    };
  }

  async currentSubscription(masterId: string) {
    const [sub] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.masterId, masterId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    if (!sub) return null;
    return {
      id: sub.id,
      tariffCode: sub.tariffCode,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  async handleWebhook(rawBody: string, signature: string | undefined) {
    if (!this.provider.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature invalid' },
      });
    }

    let event: { event: string; object: { id: string; status: string } };
    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch {
      throw new BadRequestException({
        error: { code: 'BAD_PAYLOAD', message: 'Malformed webhook payload' },
      });
    }
    if (!event?.object?.id || !event.event) {
      throw new BadRequestException({
        error: { code: 'BAD_PAYLOAD', message: 'Missing event fields' },
      });
    }

    const eventId = `${event.object.id}:${event.event}`;

    // Idempotency via unique (provider, eventId)
    const inserted = await this.db
      .insert(paymentWebhookEvents)
      .values({
        provider: 'yookassa',
        eventId,
        eventType: event.event,
        payload: event as unknown as Record<string, unknown>,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted.length === 0) {
      return { ok: true, duplicate: true };
    }

    if (event.event === 'payment.succeeded') {
      await this.settlePayment(event.object.id);
    } else if (event.event === 'payment.canceled') {
      await this.db
        .update(payments)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(payments.providerPaymentId, event.object.id));
    }

    await this.db
      .update(paymentWebhookEvents)
      .set({ processedAt: new Date() })
      .where(
        and(
          eq(paymentWebhookEvents.provider, 'yookassa'),
          eq(paymentWebhookEvents.eventId, eventId),
        ),
      );

    return { ok: true };
  }

  /**
   * Confirms the payment against the provider API before granting anything, then
   * creates or extends the subscription. The webhook body is treated as a hint only.
   */
  private async settlePayment(providerPaymentId: string): Promise<void> {
    const [payment] = await this.db
      .select()
      .from(payments)
      .where(eq(payments.providerPaymentId, providerPaymentId))
      .limit(1);

    if (!payment) {
      this.logger.warn(`Webhook for unknown payment ${providerPaymentId}`);
      return;
    }
    if (payment.status === 'succeeded') return;

    if (!(this.provider instanceof YooKassaPaymentProvider)) {
      this.logger.warn('Refusing to settle payment without a real provider');
      return;
    }

    const remote = await this.provider.fetchPaymentStatus(providerPaymentId);
    if (remote.status !== 'succeeded') {
      this.logger.warn(`Provider reports ${remote.status} for ${providerPaymentId}; not settling`);
      return;
    }
    if (remote.amount !== payment.amount) {
      this.logger.error(
        `Amount mismatch for ${providerPaymentId}: expected ${payment.amount}, got ${remote.amount}`,
      );
      return;
    }

    const meta = payment.metadata as { tariffCode?: TariffCode } | null;
    const tariffCode = meta?.tariffCode;
    if (!tariffCode) {
      this.logger.error(`Payment ${payment.id} has no tariff in metadata`);
      return;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(payments)
        .set({ status: 'succeeded', updatedAt: new Date() })
        .where(eq(payments.id, payment.id));

      const [existing] = await tx
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.masterId, payment.masterId),
            inArray(subscriptions.status, ['active', 'past_due']),
          ),
        )
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      const now = new Date();
      const base =
        existing?.currentPeriodEnd && existing.currentPeriodEnd > now
          ? existing.currentPeriodEnd
          : now;
      const periodEnd = new Date(base.getTime() + PERIOD_DAYS * 86_400_000);

      const subscriptionId = existing
        ? existing.id
        : (
            await tx
              .insert(subscriptions)
              .values({
                masterId: payment.masterId,
                tariffCode,
                status: 'active',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
              })
              .returning()
          )[0]!.id;

      if (existing) {
        await tx
          .update(subscriptions)
          .set({
            tariffCode,
            status: 'active',
            currentPeriodEnd: periodEnd,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, existing.id));
      }

      await tx.update(payments).set({ subscriptionId }).where(eq(payments.id, payment.id));

      await tx
        .update(masters)
        .set({ tariffCode, updatedAt: now })
        .where(eq(masters.id, payment.masterId));
    });
  }
}
