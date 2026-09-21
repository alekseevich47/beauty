import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import { masters, services, masterSchedules, users } from '@beauty/db';
import { APP_ENV, DB } from '../common/tokens';
import { PiiCryptoService } from '../common/crypto/pii-crypto.service';
import { BookingService } from '../booking/booking.service';

function normalizeOrigin(value: string): string {
  try {
    const url = new URL(value);
    return url.origin.toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, '');
  }
}

@Injectable()
export class WidgetService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(APP_ENV) private readonly env: Env,
    private readonly crypto: PiiCryptoService,
    private readonly booking: BookingService,
  ) {}

  /**
   * Resolves a publishable key and enforces the embedding origin.
   * The key is public by design, so the origin allowlist is what stops a third
   * party from mounting someone else's booking widget on their own site.
   */
  async resolve(publicKey: string, requestOrigin?: string) {
    const [master] = await this.db
      .select()
      .from(masters)
      .where(and(eq(masters.widgetPublicKey, publicKey), eq(masters.isActive, true)))
      .limit(1);
    if (!master) {
      throw new NotFoundException({
        error: { code: 'WIDGET_NOT_FOUND', message: 'Unknown widget key' },
      });
    }

    this.assertOriginAllowed(master.widgetAllowedOrigins, requestOrigin);

    const svc = await this.db
      .select({
        id: services.id,
        title: services.title,
        durationMin: services.durationMin,
        priceAmount: services.priceAmount,
      })
      .from(services)
      .where(and(eq(services.masterId, master.id), eq(services.isActive, true)));

    const schedule = await this.db
      .select({
        weekday: masterSchedules.weekday,
        startTime: masterSchedules.startTime,
        endTime: masterSchedules.endTime,
        slotStepMin: masterSchedules.slotStepMin,
        timezone: masterSchedules.timezone,
      })
      .from(masterSchedules)
      .where(eq(masterSchedules.masterId, master.id));

    return {
      master: {
        id: master.id,
        displayName: master.displayName,
        avatarUrl: master.avatarUrl,
        ratingAvg: Number(master.ratingAvg),
        ratingCount: master.ratingCount,
      },
      services: svc.map((s) => ({
        id: s.id,
        title: s.title,
        durationMin: s.durationMin,
        masterName: master.displayName,
        price: { amount: s.priceAmount, currency: 'RUB' as const },
      })),
      schedule,
    };
  }

  /**
   * Guest booking from a third-party site. The widget has no authenticated user, so
   * a stable pseudonymous guest account is derived from the phone number; the phone
   * itself is stored encrypted and never returned by the public API.
   */
  async book(input: {
    publicKey: string;
    serviceId: string;
    clientName: string;
    phone: string;
    startsAt: string;
    note?: string;
    origin?: string;
  }): Promise<{ ok: true; appointmentId: string }> {
    const [master] = await this.db
      .select()
      .from(masters)
      .where(and(eq(masters.widgetPublicKey, input.publicKey), eq(masters.isActive, true)))
      .limit(1);
    if (!master) {
      throw new NotFoundException({
        error: { code: 'WIDGET_NOT_FOUND', message: 'Unknown widget key' },
      });
    }

    this.assertOriginAllowed(master.widgetAllowedOrigins, input.origin);

    const [service] = await this.db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.id, input.serviceId),
          eq(services.masterId, master.id),
          eq(services.isActive, true),
        ),
      )
      .limit(1);
    if (!service) {
      throw new NotFoundException({
        error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found' },
      });
    }

    const guestId = createHash('sha256')
      .update(`${master.id}:${input.phone}`)
      .digest('hex')
      .slice(0, 48);

    const [guest] = await this.db
      .insert(users)
      .values({
        platform: 'web',
        platformUserId: guestId,
        role: 'client',
        displayName: input.clientName,
        cityId: master.cityId,
        phoneEncrypted: this.crypto.encrypt(input.phone),
      })
      .onConflictDoUpdate({
        target: [users.platform, users.platformUserId],
        set: { displayName: input.clientName, updatedAt: new Date() },
      })
      .returning();

    const appointment = await this.booking.create({
      clientId: guest!.id,
      serviceId: service.id,
      masterId: master.id,
      startsAt: input.startsAt,
      note: input.note,
    });

    return { ok: true, appointmentId: appointment.id };
  }

  private assertOriginAllowed(configured: string | null, requestOrigin: string | undefined): void {
    const allowed = (configured ?? this.env.WIDGET_DEFAULT_ALLOWED_ORIGINS)
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .map(normalizeOrigin);

    if (allowed.length === 0) {
      // Nothing configured: only permitted when the deployment explicitly opts out
      if (this.env.WIDGET_REQUIRE_ORIGIN) {
        throw new ForbiddenException({
          error: {
            code: 'ORIGIN_NOT_CONFIGURED',
            message: 'No allowed origins configured for this widget key',
          },
        });
      }
      return;
    }

    if (!requestOrigin) {
      throw new ForbiddenException({
        error: { code: 'ORIGIN_REQUIRED', message: 'Origin header required' },
      });
    }

    if (!allowed.includes(normalizeOrigin(requestOrigin))) {
      throw new ForbiddenException({
        error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed' },
      });
    }
  }
}
