import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, EmptyState, PageHeader, Panel, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export function StaffPage() {
  const { can } = useAuth();

  const staffQuery = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => api.staff(),
    enabled: can('staff.manage'),
  });

  if (!can('staff.manage')) {
    return <EmptyState title="Нет доступа" hint="Требуется staff.manage" />;
  }

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Сотрудники admin/support. Отдельная таблица staff_users, не mini-app users."
      />

      <Panel>
        {staffQuery.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-console-border text-xs uppercase tracking-wide text-console-muted">
                  <th className="pb-2 pr-3 font-medium">Имя</th>
                  <th className="pb-2 pr-3 font-medium">Email</th>
                  <th className="pb-2 pr-3 font-medium">Роли</th>
                  <th className="pb-2 pr-3 font-medium">TOTP</th>
                  <th className="pb-2 pr-3 font-medium">Последний вход</th>
                  <th className="pb-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(staffQuery.data ?? []).map((s) => (
                  <tr key={s.id} className="border-b border-console-border/60">
                    <td className="py-2.5 pr-3 font-medium">{s.displayName}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-console-muted">{s.email}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {s.roles.map((r) => (
                          <Badge key={r} tone={r === 'admin' ? 'info' : 'neutral'}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={s.totpEnabled ? 'success' : 'danger'}>
                        {s.totpEnabled ? 'on' : 'off'}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-console-muted">
                      {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="py-2.5">
                      <Badge tone={s.active ? 'success' : 'danger'}>
                        {s.active ? 'active' : 'disabled'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
