import { Button } from '@beauty/ui';
import { hasFeature } from '@beauty/entitlements';
import { useTranslation } from 'react-i18next';
import { demoClientProfile, demoMasterProfile } from '../data/mock';
import { useAppStore } from '../store/useAppStore';

export function ProfileScreen() {
  const { t } = useTranslation();
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const setTab = useAppStore((s) => s.setTab);
  const profile = role === 'master' ? demoMasterProfile : demoClientProfile;

  const premiumAi =
    role === 'master' &&
    hasFeature(
      {
        tariffCode: demoMasterProfile.tariffCode,
        subscriptionActive: true,
        overrides: [],
      },
      'ai_client_analysis',
    );

  return (
    <div className="space-y-5 py-1">
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[var(--bp-accent)] to-[var(--bp-accent-2)] font-display text-2xl font-bold text-[var(--bp-bg)]">
          {profile.displayName.slice(0, 1)}
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">{profile.displayName}</h2>
          <p className="text-sm text-[var(--bp-muted)]">
            {t('profile.role')}: {role}
            {role === 'master' && ` · ${t('profile.tariff')}: ${demoMasterProfile.tariffCode}`}
          </p>
          {premiumAi && (
            <p className="mt-1 text-xs text-[var(--bp-success)]">AI client analysis ✓</p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-[var(--bp-surface-2)] overflow-hidden rounded-2xl bg-[var(--bp-surface)]/80">
        {(
          [
            { label: t('profile.myAppointments'), action: () => setTab('appointments') },
            { label: t('profile.favorites'), action: () => setTab('favorites') },
            { label: t('profile.reviews'), action: () => undefined },
            { label: t('profile.settings'), action: () => undefined },
            { label: t('profile.help'), action: () => undefined },
          ] as const
        ).map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={item.action}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm hover:bg-[var(--bp-surface-2)]/40"
            >
              {item.label}
              <span className="text-[var(--bp-muted)]">›</span>
            </button>
          </li>
        ))}
      </ul>

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => setRole(role === 'client' ? 'master' : 'client')}
      >
        {t('profile.switchRole')}
      </Button>
    </div>
  );
}
