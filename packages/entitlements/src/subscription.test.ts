import { describe, expect, it } from 'vitest';
import { resolveFeatures } from './index';

describe('paywall enforcement', () => {
  it('grants nothing paid while a subscription is not active', () => {
    // An unpaid checkout intent must not unlock premium features
    const features = resolveFeatures({
      tariffCode: 'premium',
      subscriptionActive: false,
      overrides: [],
    });
    expect(features.has('waiting_list')).toBe(false);
    expect(features.has('ai_client_analysis')).toBe(false);
    expect(features.has('blacklist')).toBe(false);
  });

  it('keeps only free features when inactive', () => {
    const features = resolveFeatures({
      tariffCode: 'ultra',
      subscriptionActive: false,
      overrides: [],
    });
    expect([...features].sort()).toEqual(['master_of_week', 'referrals']);
  });

  it('ignores overrides while inactive', () => {
    const features = resolveFeatures({
      tariffCode: 'standard',
      subscriptionActive: false,
      overrides: [{ featureCode: 'custom_ultra', enabled: true }],
    });
    expect(features.has('custom_ultra')).toBe(false);
  });

  it('drops custom_ultra when an Ultra subscription lapses', () => {
    const active = resolveFeatures({
      tariffCode: 'ultra',
      subscriptionActive: true,
      overrides: [],
    });
    expect(active.has('custom_ultra')).toBe(true);

    const lapsed = resolveFeatures({
      tariffCode: 'ultra',
      subscriptionActive: false,
      overrides: [],
    });
    expect(lapsed.has('custom_ultra')).toBe(false);
  });

  it('lets an override revoke a tariff feature', () => {
    const features = resolveFeatures({
      tariffCode: 'premium',
      subscriptionActive: true,
      overrides: [{ featureCode: 'waiting_list', enabled: false }],
    });
    expect(features.has('waiting_list')).toBe(false);
  });
});
