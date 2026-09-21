import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ children, variant = 'primary', className = '', ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-[var(--bp-radius)] px-4 py-2 font-[var(--bp-font-body)] text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50';
  const variants: Record<NonNullable<Props['variant']>, string> = {
    primary: 'bg-[var(--bp-accent)] text-[var(--bp-bg)]',
    ghost: 'bg-transparent text-[var(--bp-text)] border border-[var(--bp-surface-2)]',
    danger: 'bg-[var(--bp-danger)] text-white',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} type="button" {...rest}>
      {children}
    </button>
  );
}
