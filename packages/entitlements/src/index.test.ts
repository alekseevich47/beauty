import { describe, expect, it } from 'vitest';
import { hasFeature, resolveFeatures } from './index.js';

describe('resolveFeatures', () => {
  it('gives premium features when active', () => {
    const set = resolveFeatures({
      tariffCode: 'premium',
      subscriptionActive: true,
      overrides: [],
    });
    expect(set.has('waiting_list')).toBe(true);
    expect(set.has('custom_ultra')).toBe(false);
  });

  it('disables custom_ultra when ultra subscription expired', () => {
    expect(
      hasFeature({ tariffCode: 'ultra', subscriptionActive: false, overrides: [] }, 'custom_ultra'),
    ).toBe(false);
  });

  it('applies per-master overrides', () => {
    const set = resolveFeatures({
      tariffCode: 'standard',
      subscriptionActive: true,
      overrides: [{ featureCode: 'waiting_list', enabled: true }],
    });
    expect(set.has('waiting_list')).toBe(true);
  });
});
