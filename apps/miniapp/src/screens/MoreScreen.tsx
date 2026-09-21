import { useTranslation } from 'react-i18next';

const links = [
  'more.settings',
  'more.subscription',
  'more.broadcast',
  'more.referrals',
  'more.help',
] as const;

export function MoreScreen() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 py-1">
      <h2 className="font-display text-xl font-semibold">{t('more.title')}</h2>
      <ul className="divide-y divide-[var(--bp-surface-2)] overflow-hidden rounded-2xl bg-[var(--bp-surface)]/80">
        {links.map((key) => (
          <li key={key}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm hover:bg-[var(--bp-surface-2)]/40"
            >
              {t(key)}
              <span className="text-[var(--bp-muted)]">›</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
