import type { DemoCategory } from '../../data/mock';

const icons: Record<string, string> = {
  scissors: '✂',
  nail: '✦',
  brow: '◠',
  brush: '🖌',
  drop: '💧',
  hand: '◎',
};

type Props = {
  categories: DemoCategory[];
  activeId?: string;
  onSelect?: (id: string) => void;
};

export function CategoryScroller({ categories, activeId, onSelect }: Props) {
  return (
    <div className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {categories.map((c) => {
        const active = c.id === activeId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect?.(c.id)}
            className={`flex min-w-[4.5rem] flex-col items-center gap-1.5 rounded-2xl px-2 py-2 text-center transition ${
              active ? 'bg-[var(--bp-surface)] text-[var(--bp-text)]' : 'text-[var(--bp-muted)]'
            }`}
          >
            <span
              className={`grid h-11 w-11 place-items-center rounded-2xl text-lg ${
                active ? 'bg-[var(--bp-accent)]/20' : 'bg-[var(--bp-surface-2)]'
              }`}
            >
              {icons[c.iconKey] ?? '●'}
            </span>
            <span className="text-[11px] font-medium">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
