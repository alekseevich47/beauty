import { useTranslation } from 'react-i18next';
import type { DemoService } from '../../data/mock';

type Props = {
  service: DemoService;
  onOpen?: (service: DemoService) => void;
};

export function ServiceCard({ service, onOpen }: Props) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onOpen?.(service)}
      className="flex w-full gap-3 rounded-[var(--bp-radius)] border border-transparent bg-[var(--bp-surface)]/70 p-3 text-left transition hover:border-[var(--bp-surface-2)]"
    >
      <div className="h-16 w-16 shrink-0 rounded-xl bg-[linear-gradient(135deg,#2a3544,#1a222c)]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-medium">{service.title}</h3>
          <span className="shrink-0 text-sm font-semibold text-[var(--bp-accent)]">
            {t('common.rub', { amount: service.price.toLocaleString('ru-RU') })}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[var(--bp-muted)]">
          {t('common.min', { count: service.durationMin })} · {service.master.displayName}
        </p>
      </div>
    </button>
  );
}
