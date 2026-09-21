import { AnimatePresence, motion } from 'framer-motion';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, type AppTab, type ClientTab, type MasterTab } from '../../store/useAppStore';

const LONG_PRESS_MS = 450;

type NavItem = {
  id: AppTab;
  labelKey: string;
  kind: 'tab' | 'center' | 'avatar';
};

const clientItems: NavItem[] = [
  { id: 'appointments', labelKey: 'nav.appointments', kind: 'tab' },
  { id: 'bplus', labelKey: 'nav.bplus', kind: 'center' },
  { id: 'favorites', labelKey: 'nav.favorites', kind: 'tab' },
];

const masterItems: NavItem[] = [
  { id: 'feed', labelKey: 'nav.feed', kind: 'tab' },
  { id: 'schedule', labelKey: 'nav.schedule', kind: 'tab' },
  { id: 'bplus', labelKey: 'nav.bplus', kind: 'center' },
  { id: 'profile', labelKey: 'nav.profile', kind: 'avatar' },
  { id: 'more', labelKey: 'nav.more', kind: 'tab' },
];

export function BottomNav() {
  const { t } = useTranslation();
  const role = useAppStore((s) => s.role);
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const setAiOpen = useAppStore((s) => s.setAiOpen);
  const items = role === 'client' ? clientItems : masterItems;
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onCenterDown = () => {
    if (role !== 'master') return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setAiOpen(true);
    }, LONG_PRESS_MS);
  };

  const onCenterUp = () => {
    clearTimer();
    if (role === 'master' && longPressed.current) return;
    setTab('bplus');
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--bp-surface-2)] bg-[color-mix(in_srgb,var(--bp-bg)_92%,transparent)] px-2 pb-[max(0.5rem,var(--safe-bottom))] pt-2 backdrop-blur-lg">
      <ul className="mx-auto flex max-w-lg items-end justify-between gap-1">
        {items.map((item) => {
          const active = tab === item.id;
          if (item.kind === 'center') {
            return (
              <li key={item.id} className="relative -mt-5 flex flex-1 justify-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onPointerDown={onCenterDown}
                  onPointerUp={onCenterUp}
                  onPointerLeave={clearTimer}
                  onPointerCancel={clearTimer}
                  className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[var(--bp-accent)] to-[#c97b4f] font-display text-lg font-bold text-[var(--bp-bg)] shadow-[0_8px_24px_rgba(232,168,124,0.35)]"
                  aria-label={t(item.labelKey)}
                >
                  B+
                </motion.button>
              </li>
            );
          }

          if (item.kind === 'avatar') {
            return (
              <li key={item.id} className="flex flex-1 justify-center">
                <button
                  type="button"
                  onClick={() => setTab(item.id as MasterTab)}
                  className="flex flex-col items-center gap-1 text-[10px] text-[var(--bp-muted)]"
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-semibold ${
                      active
                        ? 'bg-[var(--bp-accent)] text-[var(--bp-bg)]'
                        : 'bg-[var(--bp-surface-2)] text-[var(--bp-text)]'
                    }`}
                  >
                    М
                  </span>
                  <span className={active ? 'text-[var(--bp-text)]' : ''}>{t(item.labelKey)}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={item.id} className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={() => setTab(item.id as ClientTab | MasterTab)}
                className="flex min-w-[3.5rem] flex-col items-center gap-1 px-1 py-1 text-[10px]"
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${item.id}-${active}`}
                    initial={{ opacity: 0.5, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-[11px] font-medium ${
                      active ? 'text-[var(--bp-accent)]' : 'text-[var(--bp-muted)]'
                    }`}
                  >
                    {t(item.labelKey)}
                  </motion.span>
                </AnimatePresence>
                <span
                  className={`h-1 w-1 rounded-full ${active ? 'bg-[var(--bp-accent)]' : 'bg-transparent'}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
