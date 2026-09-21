import { Button } from '@beauty/ui';
import useEmblaCarousel from 'embla-carousel-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { DemoMaster } from '../../data/mock';

type Props = {
  masters: DemoMaster[];
};

export function MasterOfWeekCarousel({ masters }: Props) {
  const { t } = useTranslation();
  const [emblaRef] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps' });

  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold">{t('feed.masterOfWeek')}</h2>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {masters.map((m, i) => (
            <motion.article
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="min-w-[78%] shrink-0 overflow-hidden rounded-[var(--bp-radius)] border border-[var(--bp-surface-2)] bg-[linear-gradient(145deg,#1c2633_0%,#151c26_55%,#1a1512_100%)] p-4"
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bp-accent)]">
                {t('feed.masterOfWeek')} · {m.category}
              </p>
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[var(--bp-accent)]/80 to-[var(--bp-surface-2)] font-display text-xl font-bold text-[var(--bp-bg)]">
                  {m.displayName.slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">{m.displayName}</h3>
                  <p className="text-sm text-[var(--bp-muted)]">
                    {t('feed.rating', { value: m.ratingAvg.toFixed(2) })} · {m.weekServices} услуг
                  </p>
                </div>
              </div>
              <Button className="w-full">{t('feed.book')}</Button>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
