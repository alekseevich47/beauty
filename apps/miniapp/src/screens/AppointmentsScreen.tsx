import { Skeleton } from '@beauty/ui';
import { useTranslation } from 'react-i18next';
import { useAppointmentsQuery } from '../data/queries';
import { useAppStore } from '../store/useAppStore';

export function AppointmentsScreen() {
  const { t } = useTranslation();
  const role = useAppStore((s) => s.role);
  const { data, isLoading } = useAppointmentsQuery(role);

  return (
    <div className="space-y-4 py-1">
      <h2 className="font-display text-xl font-semibold">{t('appointments.title')}</h2>
      {isLoading || !data ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm text-[var(--bp-muted)]">{t('appointments.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id} className="rounded-2xl bg-[var(--bp-surface)]/80 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.serviceTitle}</p>
                  <p className="mt-1 text-sm text-[var(--bp-muted)]">
                    {role === 'client' ? a.masterName : a.clientName}
                  </p>
                  <p className="mt-1 text-xs text-[var(--bp-muted)]">
                    {new Date(a.startsAt).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="rounded-lg bg-[var(--bp-surface-2)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--bp-muted)]">
                    {t(`appointments.status.${a.status}`)}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-[var(--bp-accent)]">
                    {t('common.rub', { amount: a.price.toLocaleString('ru-RU') })}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
