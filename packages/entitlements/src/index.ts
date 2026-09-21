import type { FeatureCode, TariffCode } from '@beauty/contracts';

/** Base tariff → feature matrix (source of truth for seeds + runtime defaults). */
export const TARIFF_FEATURES: Record<TariffCode, readonly FeatureCode[]> = {
  standard: ['analytics_basic', 'referrals', 'master_of_week', 'broadcast_monthly'],
  premium: [
    'analytics_basic',
    'referrals',
    'master_of_week',
    'broadcast_monthly',
    'broadcast_biweekly',
    'broadcast_weekly',
    'blacklist',
    'auto_fill_cancellations',
    'waiting_list',
    'ai_client_analysis',
    'auto_return_client',
    'cabinet_branding',
    'category_highlight',
  ],
  ultra: [
    'analytics_basic',
    'referrals',
    'master_of_week',
    'broadcast_monthly',
    'broadcast_biweekly',
    'broadcast_weekly',
    'blacklist',
    'auto_fill_cancellations',
    'waiting_list',
    'ai_client_analysis',
    'auto_return_client',
    'cabinet_branding',
    'category_highlight',
    'custom_ultra',
  ],
} as const;

export type MasterOverride = {
  featureCode: FeatureCode;
  enabled: boolean;
};

export type EntitlementSnapshot = {
  tariffCode: TariffCode;
  subscriptionActive: boolean;
  overrides: MasterOverride[];
};

/**
 * Resolve effective features for a master.
 * Expired Ultra subscriptions automatically disable `custom_ultra`.
 */
export function resolveFeatures(snapshot: EntitlementSnapshot): Set<FeatureCode> {
  const base = new Set<FeatureCode>(TARIFF_FEATURES[snapshot.tariffCode]);

  if (!snapshot.subscriptionActive) {
    if (snapshot.tariffCode === 'ultra') {
      base.delete('custom_ultra');
    }
    // Non-active subscription keeps only free features
    return new Set<FeatureCode>(['master_of_week', 'referrals']);
  }

  for (const o of snapshot.overrides) {
    if (o.enabled) base.add(o.featureCode);
    else base.delete(o.featureCode);
  }

  return base;
}

export function hasFeature(snapshot: EntitlementSnapshot, feature: FeatureCode): boolean {
  return resolveFeatures(snapshot).has(feature);
}

export const BROADCAST_LIMITS: Record<TariffCode, { perMonth: number }> = {
  standard: { perMonth: 1 },
  premium: { perMonth: 4 },
  ultra: { perMonth: 8 },
};
