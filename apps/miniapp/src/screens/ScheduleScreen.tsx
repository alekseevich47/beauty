import { Skeleton } from '@beauty/ui';
import { useTranslation } from 'react-i18next';
import { useAppointmentsQuery } from '../data/queries';

export function ScheduleScreen() {
  const { t } = useTranslation();
  const { data, isLoading } = useAppointmentsQuery('master');

  return (
    <div className="space-y-4 py-1">
      <h2 className="font-display text-xl font-semibold">{t('schedule.title')}</h2>
      {isLoading || !data ? (
        <Skeleton className="h-28 w-full" />
      ) : data.length === 0 ? (
        <p className="text-sm text-[var(--bp-muted)]">{t('schedule.empty')}</p>
      ) : (
        <ul className="relative space-y-0 border-l border-[var(--bp-surface-2)] pl-4">
          {data.map((a) => (
            <li key={a.id} className="relative pb-5">
              <span className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--bp-accent)]" />
              <p className="text-xs text-[var(--bp-muted)]">
                {new Date(a.startsAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="mt-0.5 font-medium">{a.clientName}</p>
              <p className="text-sm text-[var(--bp-muted)]">
                {a.serviceTitle} · {t('common.rub', { amount: a.price.toLocaleString('ru-RU') })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
