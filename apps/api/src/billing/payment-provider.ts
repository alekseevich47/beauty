import { createHmac, timingSafeEqual } from 'node:crypto';

export type CreatePaymentInput = {
  amount: number;
  currency: 'RUB';
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  idempotenceKey: string;
};

export type CreatePaymentResult = {
  providerPaymentId: string;
  confirmationUrl: string;
  status: 'pending' | 'succeeded' | 'cancelled';
};

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}

/**
 * Used when payments are disabled. It can create a placeholder payment so the UI
 * flow is testable, but it must never accept a webhook: without a provider there is
 * nothing to authenticate, so any accepted callback would be a free subscription.
 */
export class NoopPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      providerPaymentId: `noop_${input.idempotenceKey}`,
      confirmationUrl: input.returnUrl,
      status: 'pending',
    };
  }

  verifyWebhookSignature(): boolean {
    return false;
  }
}

export class YooKassaPaymentProvider implements PaymentProvider {
  constructor(
    private readonly shopId: string,
    private readonly secretKey: string,
    private readonly webhookSecret?: string,
  ) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
    const res = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Idempotence-Key': input.idempotenceKey,
      },
      body: JSON.stringify({
        amount: {
          value: (input.amount / 100).toFixed(2),
          currency: input.currency,
        },
        confirmation: {
          type: 'redirect',
          return_url: input.returnUrl,
        },
        capture: true,
        description: input.description,
        metadata: input.metadata,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YooKassa error: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      id: string;
      status: string;
      confirmation?: { confirmation_url?: string };
    };

    return {
      providerPaymentId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url ?? input.returnUrl,
      status: data.status === 'succeeded' ? 'succeeded' : 'pending',
    };
  }

  /**
   * Fails closed: an unconfigured secret or a missing signature is rejected rather
   * than trusted, so a forged `payment.succeeded` can never activate a subscription.
   */
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!this.webhookSecret || !signature) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    try {
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(signature, 'utf8');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /** Authoritative status straight from the provider API — never from webhook body. */
  async fetchPaymentStatus(
    providerPaymentId: string,
  ): Promise<{ status: string; amount: number; metadata: Record<string, string> }> {
    const auth = Buffer.from(`${this.shopId}:${this.secretKey}`).toString('base64');
    const res = await fetch(
      `https://api.yookassa.ru/v3/payments/${encodeURIComponent(providerPaymentId)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) {
      throw new Error(`YooKassa status fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      status: string;
      amount?: { value?: string };
      metadata?: Record<string, string>;
    };
    return {
      status: data.status,
      amount: Math.round(Number(data.amount?.value ?? 0) * 100),
      metadata: data.metadata ?? {},
    };
  }
}
