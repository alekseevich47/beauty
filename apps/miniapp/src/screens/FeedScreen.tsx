import { Skeleton } from '@beauty/ui';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookForm } from '../components/BookForm';
import { CategoryScroller } from '../components/feed/CategoryScroller';
import { MasterOfWeekCarousel } from '../components/feed/MasterOfWeekCarousel';
import { ServiceCard } from '../components/feed/ServiceCard';
import type { DemoService } from '../data/mock';
import { useFeedQuery } from '../data/queries';
import { greetingKey } from '../lib/greeting';
import { useAppStore } from '../store/useAppStore';

export function FeedScreen() {
  const { t } = useTranslation();
  const cityName = useAppStore((s) => s.cityName);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const { data, isLoading } = useFeedQuery();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [booking, setBooking] = useState<DemoService | null>(null);

  const greeting = useMemo(() => t(greetingKey()), [t]);

  const services = useMemo(() => {
    if (!data) return [];
    return data.services.filter((s) => {
      const byCat = !categoryId || s.categoryId === categoryId;
      const q = searchQuery.trim().toLowerCase();
      const byQ =
        !q || s.title.toLowerCase().includes(q) || s.master.displayName.toLowerCase().includes(q);
      return byCat && byQ;
    });
  }, [data, categoryId, searchQuery]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-1">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-2xl font-semibold"
        >
          {greeting}
        </motion.p>
        <button
          type="button"
          className="mt-1 text-sm text-[var(--bp-muted)] underline-offset-2 hover:underline"
        >
          {t('feed.city')}: {cityName}
        </button>
      </div>

      <label className="block">
        <span className="sr-only">{t('feed.search')}</span>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('feed.search')}
          className="w-full rounded-2xl border border-[var(--bp-surface-2)] bg-[var(--bp-surface)] px-4 py-3 text-sm outline-none ring-[var(--bp-accent)] focus:ring-1"
        />
      </label>

      <CategoryScroller
        categories={data.categories}
        activeId={categoryId}
        onSelect={(id) => setCategoryId((prev) => (prev === id ? undefined : id))}
      />

      <MasterOfWeekCarousel masters={data.mastersOfWeek} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{t('feed.popular')}</h2>
        <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
          {data.popular.map((p) => (
            <div
              key={p.id}
              className={`min-w-[7.5rem] rounded-2xl bg-gradient-to-br ${p.accent} p-3`}
            >
              <p className="font-medium">{p.id === 'all' ? t('feed.all') : p.title}</p>
              <p className="mt-1 text-xs text-[var(--bp-muted)]">
                {t('feed.masters', { count: p.mastersCount })}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 pb-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('feed.services')}</h2>
          <span className="text-xs text-[var(--bp-muted)]" aria-hidden>
            ▢
          </span>
        </div>
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} onOpen={setBooking} />
          ))}
        </div>
      </section>

      {booking ? (
        <BookForm
          serviceId={booking.id}
          masterId={booking.master.id}
          serviceTitle={booking.title}
          onClose={() => setBooking(null)}
        />
      ) : null}
    </div>
  );
}
