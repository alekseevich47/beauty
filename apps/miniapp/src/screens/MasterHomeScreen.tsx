import { Skeleton } from '@beauty/ui';
import { motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RevenueChart } from '../components/charts/RevenueChart';
import { useAppointmentsQuery, useRevenueQuery } from '../data/queries';
import { greetingKey } from '../lib/greeting';
import { useAppStore } from '../store/useAppStore';

type Period = 'day' | 'week' | 'month';

export function MasterHomeScreen() {
  const { t } = useTranslation();
  const setTab = useAppStore((s) => s.setTab);
  const [period, setPeriod] = useState<Period>('day');
  const { data: revenue, isLoading: revLoading } = useRevenueQuery(period);
  const { data: appointments, isLoading: apLoading } = useAppointmentsQuery('master');
  const touchX = useRef(0);

  const greeting = useMemo(() => t(greetingKey()), [t]);
  const titleKey =
    period === 'day'
      ? 'masterHome.revenueToday'
      : period === 'week'
        ? 'masterHome.revenueWeek'
        : 'masterHome.revenueMonth';

  const onSwipePeriod = (dir: 1 | -1) => {
    const order: Period[] = ['day', 'week', 'month'];
    const idx = order.indexOf(period);
    const next = order[(idx + dir + order.length) % order.length];
    if (next) setPeriod(next);
  };

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
        <p className="mt-2 text-sm leading-relaxed text-[var(--bp-muted)]">
          {t('masterHome.motivation', { percent: 12 })}
        </p>
      </div>

      {revLoading || !revenue ? (
        <Skeleton className="h-36 w-full" />
      ) : (
        <motion.section
          key={period}
          initial={{ opacity: 0.6, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[var(--bp-radius)] border border-[var(--bp-surface-2)] bg-[var(--bp-surface)]/80 p-4"
          onTouchStart={(e) => {
            touchX.current = e.changedTouches[0]?.clientX ?? 0;
          }}
          onTouchEnd={(e) => {
            const x = e.changedTouches[0]?.clientX ?? 0;
            const dx = x - touchX.current;
            if (Math.abs(dx) > 40) onSwipePeriod(dx < 0 ? 1 : -1);
          }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-[var(--bp-muted)]">{t(titleKey)}</p>
            <div className="flex gap-1">
              {(['day', 'week', 'month'] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`h-1.5 w-4 rounded-full ${p === period ? 'bg-[var(--bp-accent)]' : 'bg-[var(--bp-surface-2)]'}`}
                  aria-label={p}
                />
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-bold tracking-tight">
                {t('common.rub', { amount: revenue.amount.toLocaleString('ru-RU') })}
              </p>
              <p
                className={`mt-1 text-sm ${
                  revenue.direction === 'up'
                    ? 'text-[var(--bp-success)]'
                    : revenue.direction === 'down'
                      ? 'text-[var(--bp-danger)]'
                      : 'text-[var(--bp-muted)]'
                }`}
              >
                {revenue.direction === 'up' ? '↑' : revenue.direction === 'down' ? '↓' : '→'}{' '}
                {Math.abs(revenue.deltaPercent).toFixed(1)}%
              </p>
            </div>
            <div className="w-[48%]">
              <RevenueChart series={revenue.series} />
            </div>
          </div>
        </motion.section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('masterHome.upcoming')}</h2>
          <button
            type="button"
            onClick={() => setTab('schedule')}
            className="text-sm text-[var(--bp-accent)]"
          >
            {t('masterHome.seeAll')}
          </button>
        </div>
        {apLoading || !appointments ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="space-y-2">
            {appointments.slice(0, 3).map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl bg-[var(--bp-surface)]/70 p-3"
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--bp-surface-2)] text-sm font-semibold">
                  {a.clientName.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.clientName}</p>
                  <p className="truncate text-xs text-[var(--bp-muted)]">
                    {formatTime(a.startsAt)} · {a.serviceTitle}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[var(--bp-accent)]">
                  {t('common.rub', { amount: a.price.toLocaleString('ru-RU') })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
