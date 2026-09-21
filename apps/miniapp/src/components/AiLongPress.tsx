import { motionPresets } from '@beauty/ui';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

export function AiLongPressBar() {
  const { t } = useTranslation();
  const draft = useAppStore((s) => s.aiDraft);
  const setAiDraft = useAppStore((s) => s.setAiDraft);
  const setAiOpen = useAppStore((s) => s.setAiOpen);

  return (
    <motion.div
      {...motionPresets.longPressReveal}
      className="fixed inset-x-0 bottom-[calc(4.25rem+var(--safe-bottom))] z-50 mx-auto max-w-lg overflow-hidden px-3"
    >
      <div className="rounded-2xl border border-[var(--bp-surface-2)] bg-[var(--bp-surface)] p-3 shadow-2xl">
        <p className="mb-2 text-[11px] text-[var(--bp-muted)]">{t('masterHome.aiHint')}</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setAiDraft(e.target.value)}
            placeholder={t('masterHome.aiPlaceholder')}
            className="flex-1 rounded-xl border border-[var(--bp-surface-2)] bg-[var(--bp-bg)] px-3 py-2.5 text-sm outline-none ring-[var(--bp-accent)] focus:ring-1"
          />
          <button
            type="button"
            onClick={() => {
              setAiDraft('');
              setAiOpen(false);
            }}
            className="rounded-xl bg-[var(--bp-accent)] px-3 py-2 text-sm font-semibold text-[var(--bp-bg)]"
          >
            AI
          </button>
          <button
            type="button"
            onClick={() => setAiOpen(false)}
            className="rounded-xl border border-[var(--bp-surface-2)] px-3 py-2 text-sm text-[var(--bp-muted)]"
          >
            ×
          </button>
        </div>
      </div>
    </motion.div>
  );
}
