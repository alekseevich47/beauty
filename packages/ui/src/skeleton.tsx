type Props = { className?: string };

export function Skeleton({ className = '' }: Props) {
  return (
    <div className={`animate-pulse rounded-lg bg-[var(--bp-surface-2)] ${className}`} aria-hidden />
  );
}
