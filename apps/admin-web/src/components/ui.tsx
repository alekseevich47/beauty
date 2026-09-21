import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return clsx(parts);
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-console-text">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-console-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
  title,
  actions,
  flush,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  actions?: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className={cx('rounded border border-console-border bg-console-surface', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-console-border px-4 py-3">
          {title ? <h2 className="text-sm font-medium text-console-text">{title}</h2> : <span />}
          {actions}
        </div>
      )}
      <div className={flush ? undefined : 'p-4'}>{children}</div>
    </section>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-console-accent text-white hover:bg-console-accent-hover',
        variant === 'secondary' &&
          'border border-console-border bg-console-raised text-console-text hover:bg-console-border/40',
        variant === 'danger' && 'bg-console-danger text-white hover:brightness-110',
        variant === 'ghost' && 'text-console-muted hover:bg-console-raised hover:text-console-text',
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded border border-console-border bg-console-bg px-3 text-sm text-console-text placeholder:text-console-muted/70 outline-none focus:border-console-accent',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-console-muted">
      {children}
    </label>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-console-danger">{message}</p>;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide',
        tone === 'neutral' && 'bg-console-raised text-console-muted',
        tone === 'success' && 'bg-console-success/15 text-console-success',
        tone === 'warning' && 'bg-console-warning/15 text-console-warning',
        tone === 'danger' && 'bg-console-danger/15 text-console-danger',
        tone === 'info' && 'bg-console-info/15 text-console-info',
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-console-muted" role="status">
      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-console-border border-t-console-accent" />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm font-medium text-console-text">{title}</p>
      {hint ? <p className="mt-1 text-xs text-console-muted">{hint}</p> : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded border border-console-border bg-console-surface p-5 shadow-xl"
      >
        <h3 id="confirm-title" className="text-base font-semibold text-console-text">
          {title}
        </h3>
        <p className="mt-2 text-sm text-console-muted">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
