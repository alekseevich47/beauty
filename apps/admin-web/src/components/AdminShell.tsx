import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, Button, Spinner, cx } from '@/components/ui';
import { isDemoMode } from '@/lib/demo';
import { NAV_ITEMS } from '@/lib/permissions';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Проверка сессии…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function AdminShell() {
  const { user, logout, canAny } = useAuth();
  const demo = isDemoMode();

  const visibleNav = NAV_ITEMS.filter((item) => canAny(item.permissions));

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-console-border bg-console-surface">
        <div className="border-b border-console-border px-4 py-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-console-muted">
            Beauty+
          </div>
          <div className="mt-0.5 text-sm font-semibold text-console-text">Ops Console</div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Разделы">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cx(
                  'block rounded px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-console-raised font-medium text-console-text'
                    : 'text-console-muted hover:bg-console-raised/60 hover:text-console-text',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-console-border p-3">
          <div className="truncate text-xs font-medium text-console-text">{user?.displayName}</div>
          <div className="mt-0.5 truncate font-mono text-[11px] text-console-muted">
            {user?.email}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {user?.roles.map((r) => (
              <Badge key={r} tone={r === 'admin' ? 'info' : 'neutral'}>
                {r}
              </Badge>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => void logout()}>
            Выйти
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {demo ? (
          <div className="border-b border-console-warning/30 bg-console-warning/10 px-4 py-2 text-center text-xs text-console-warning">
            Demo mode — cookie-сессия эмулируется локально. TOTP: любой 6-значный код (000000 =
            support).
          </div>
        ) : null}
        <main className="min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
