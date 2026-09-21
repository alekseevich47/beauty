import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AdminShell, RequireAuth } from '@/components/AdminShell';
import { EmptyState, Spinner } from '@/components/ui';
import type { PermissionCode } from '@beauty/contracts';
import { LoginPage } from '@/pages/LoginPage';
import { TotpPage } from '@/pages/TotpPage';
import { ChatPage } from '@/pages/ChatPage';
import { AccountsPage } from '@/pages/AccountsPage';

const MonitoringPage = lazy(() =>
  import('@/pages/MonitoringPage').then((m) => ({ default: m.MonitoringPage })),
);
const FeaturesPage = lazy(() =>
  import('@/pages/FeaturesPage').then((m) => ({ default: m.FeaturesPage })),
);
const OpsPage = lazy(() => import('@/pages/OpsPage').then((m) => ({ default: m.OpsPage })));
const StaffPage = lazy(() => import('@/pages/StaffPage').then((m) => ({ default: m.StaffPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then((m) => ({ default: m.AuditPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RequirePermission({
  anyOf,
  children,
}: {
  anyOf: readonly PermissionCode[];
  children: React.ReactNode;
}) {
  const { canAny } = useAuth();
  if (!canAny(anyOf)) {
    return <EmptyState title="403" hint="Недостаточно прав для этого раздела" />;
  }
  return children;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Spinner label="Загрузка раздела…" />}>{children}</Suspense>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/totp" element={<TotpPage />} />
            <Route
              element={
                <RequireAuth>
                  <AdminShell />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="/chat" replace />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route
                path="/monitoring"
                element={
                  <RequirePermission anyOf={['ops.metrics']}>
                    <LazyPage>
                      <MonitoringPage />
                    </LazyPage>
                  </RequirePermission>
                }
              />
              <Route
                path="/features"
                element={
                  <RequirePermission anyOf={['features.toggle', 'tariffs.manage']}>
                    <LazyPage>
                      <FeaturesPage />
                    </LazyPage>
                  </RequirePermission>
                }
              />
              <Route
                path="/ops"
                element={
                  <RequirePermission anyOf={['ops.restart', 'ops.backup']}>
                    <LazyPage>
                      <OpsPage />
                    </LazyPage>
                  </RequirePermission>
                }
              />
              <Route
                path="/staff"
                element={
                  <RequirePermission anyOf={['staff.manage']}>
                    <LazyPage>
                      <StaffPage />
                    </LazyPage>
                  </RequirePermission>
                }
              />
              <Route
                path="/audit"
                element={
                  <RequirePermission anyOf={['audit.read']}>
                    <LazyPage>
                      <AuditPage />
                    </LazyPage>
                  </RequirePermission>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/chat" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
