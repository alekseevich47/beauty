import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../../platform/PlatformProvider';
import { useAppStore } from '../../store/useAppStore';

type Props = {
  onAvatarClick?: () => void;
  showAvatar?: boolean;
};

export function Header({ onAvatarClick, showAvatar = true }: Props) {
  const { t } = useTranslation();
  const { kind } = usePlatform();
  const role = useAppStore((s) => s.role);

  const initial = useMemo(() => (role === 'master' ? 'М' : 'К'), [role]);

  return (
    <header className="safe-pt sticky top-0 z-30 flex items-center justify-between px-4 pb-3 backdrop-blur-md bg-[color-mix(in_srgb,var(--bp-bg)_78%,transparent)]">
      <div className="flex items-baseline gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--bp-text)]">
          {t('brand')}
        </h1>
        {kind === 'web' && (
          <span className="rounded-md bg-[var(--bp-surface-2)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--bp-muted)]">
            {t('common.demo')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--bp-surface-2)] bg-[var(--bp-surface)] text-[var(--bp-muted)] transition hover:text-[var(--bp-text)]"
          aria-label={t('header.notifications')}
        >
          <BellIcon />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[var(--bp-accent)]" />
        </button>
        {showAvatar && (
          <button
            type="button"
            onClick={onAvatarClick}
            className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[var(--bp-accent)] to-[var(--bp-accent-2)] text-sm font-bold text-[var(--bp-bg)]"
            aria-label={t('nav.profile')}
          >
            {initial}
          </button>
        )}
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
