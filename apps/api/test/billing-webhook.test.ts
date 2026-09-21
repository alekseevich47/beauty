import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { NoopPaymentProvider, YooKassaPaymentProvider } from '../src/billing/payment-provider';

const body = JSON.stringify({
  event: 'payment.succeeded',
  object: { id: 'noop_11111111-1111-1111-1111-111111111111', status: 'succeeded' },
});

describe('webhook signature verification', () => {
  it('rejects every webhook when payments are disabled', () => {
    // Guards the free-subscription path: the noop provider has no shared secret,
    // so a forged payment.succeeded must never be accepted.
    const provider = new NoopPaymentProvider();
    expect(provider.verifyWebhookSignature()).toBe(false);
  });

  it('rejects when no webhook secret is configured', () => {
    const provider = new YooKassaPaymentProvider('shop', 'key', undefined);
    const anySignature = createHmac('sha256', 'guess').update(body).digest('hex');
    expect(provider.verifyWebhookSignature(body, anySignature)).toBe(false);
  });

  it('rejects a missing signature', () => {
    const provider = new YooKassaPaymentProvider('shop', 'key', 'secret');
    expect(provider.verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects a signature computed with the wrong secret', () => {
    const provider = new YooKassaPaymentProvider('shop', 'key', 'real-secret');
    const forged = createHmac('sha256', 'wrong-secret').update(body).digest('hex');
    expect(provider.verifyWebhookSignature(body, forged)).toBe(false);
  });

  it('rejects a valid signature over tampered content', () => {
    const provider = new YooKassaPaymentProvider('shop', 'key', 'real-secret');
    const signature = createHmac('sha256', 'real-secret').update(body).digest('hex');
    const tampered = body.replace('succeeded', 'canceled');
    expect(provider.verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('accepts a correctly signed body', () => {
    const provider = new YooKassaPaymentProvider('shop', 'key', 'real-secret');
    const signature = createHmac('sha256', 'real-secret').update(body).digest('hex');
    expect(provider.verifyWebhookSignature(body, signature)).toBe(true);
  });
});

describe('payment creation', () => {
  it('never takes an amount from the caller-facing response path', async () => {
    const provider = new NoopPaymentProvider();
    const result = await provider.createPayment({
      amount: 249000,
      currency: 'RUB',
      description: 'Beauty+ premium',
      returnUrl: 'https://beauty.loomixx.ru',
      metadata: { tariffCode: 'premium' },
      idempotenceKey: 'abc',
    });
    expect(result.status).toBe('pending');
    expect(result.providerPaymentId).toBe('noop_abc');
  });
});
