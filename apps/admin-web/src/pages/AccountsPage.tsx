import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, EmptyState, Input, PageHeader, Panel, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export function AccountsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['accounts', q],
    queryFn: () => api.accounts(q),
    enabled: can('accounts.read'),
  });

  if (!can('accounts.read')) {
    return <EmptyState title="Нет доступа" hint="Требуется accounts.read" />;
  }

  return (
    <div>
      <PageHeader
        title="Аккаунты"
        description="Клиенты и мастера. PII минимизирован для support."
        actions={
          <Input
            className="w-64"
            placeholder="Поиск по имени, email, телефону"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      />

      <Panel>
        {accountsQuery.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-console-border text-xs uppercase tracking-wide text-console-muted">
                  <th className="pb-2 pr-3 font-medium">Имя</th>
                  <th className="pb-2 pr-3 font-medium">Тип</th>
                  <th className="pb-2 pr-3 font-medium">Контакт</th>
                  <th className="pb-2 pr-3 font-medium">Город</th>
                  <th className="pb-2 pr-3 font-medium">Тариф</th>
                  <th className="pb-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {(accountsQuery.data ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-console-border/60">
                    <td className="py-2.5 pr-3 font-medium text-console-text">{a.displayName}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={a.kind === 'master' ? 'info' : 'neutral'}>{a.kind}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-console-muted">
                      {a.email ?? a.phone ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-console-muted">{a.city ?? '—'}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{a.tariffCode ?? '—'}</td>
                    <td className="py-2.5">
                      <Badge
                        tone={
                          a.status === 'active'
                            ? 'success'
                            : a.status === 'suspended'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {a.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(accountsQuery.data ?? []).length === 0 ? (
              <EmptyState title="Ничего не найдено" />
            ) : null}
          </div>
        )}
      </Panel>
    </div>
  );
}
