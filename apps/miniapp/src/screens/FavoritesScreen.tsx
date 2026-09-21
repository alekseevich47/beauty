import { Button, Skeleton } from '@beauty/ui';
import { useTranslation } from 'react-i18next';
import { useFavoritesQuery } from '../data/queries';

export function FavoritesScreen() {
  const { t } = useTranslation();
  const { data, isLoading } = useFavoritesQuery();

  return (
    <div className="space-y-4 py-1">
      <h2 className="font-display text-xl font-semibold">{t('favorites.title')}</h2>
      {isLoading || !data ? (
        <Skeleton className="h-24 w-full" />
      ) : data.length === 0 ? (
        <p className="text-sm text-[var(--bp-muted)]">{t('favorites.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {data.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-3 rounded-2xl bg-[var(--bp-surface)]/80 p-3"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[var(--bp-accent)]/70 to-[var(--bp-surface-2)] font-display font-bold text-[var(--bp-bg)]">
                {m.displayName.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.displayName}</p>
                <p className="text-xs text-[var(--bp-muted)]">
                  {t('feed.rating', { value: m.ratingAvg.toFixed(2) })} · {m.category}
                </p>
              </div>
              <Button className="!px-3 !py-1.5 text-xs">{t('feed.book')}</Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
