import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, PageHeader, Panel, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export function AuditPage() {
  const { can } = useAuth();

  const auditQuery = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.audit(),
    enabled: can('audit.read'),
  });

  if (!can('audit.read')) {
    return <EmptyState title="Нет доступа" hint="Требуется audit.read" />;
  }

  return (
    <div>
      <PageHeader
        title="Аудит"
        description="Кто / что / когда / над каким объектом. Обязателен для правок и ops."
      />

      <Panel>
        {auditQuery.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-console-border text-xs uppercase tracking-wide text-console-muted">
                  <th className="pb-2 pr-3 font-medium">Время</th>
                  <th className="pb-2 pr-3 font-medium">Actor</th>
                  <th className="pb-2 pr-3 font-medium">Action</th>
                  <th className="pb-2 pr-3 font-medium">Entity</th>
                  <th className="pb-2 font-medium">Meta</th>
                </tr>
              </thead>
              <tbody>
                {(auditQuery.data ?? []).map((e) => (
                  <tr key={e.id} className="border-b border-console-border/60 align-top">
                    <td className="py-2.5 pr-3 font-mono text-xs text-console-muted">
                      {new Date(e.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{e.actorEmail}</td>
                    <td className="py-2.5 pr-3 font-medium">{e.action}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-console-muted">
                      {e.entityType}/{e.entityId}
                    </td>
                    <td className="py-2.5 font-mono text-[11px] text-console-muted">
                      {JSON.stringify(e.meta)}
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
