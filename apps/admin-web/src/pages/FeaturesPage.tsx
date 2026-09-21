import { useQuery } from '@tanstack/react-query';
import type { TariffCode } from '@beauty/contracts';

import { useAuth } from '@/auth/AuthProvider';
import { Badge, EmptyState, PageHeader, Panel, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

const TARIFFS: TariffCode[] = ['standard', 'premium', 'ultra'];

export function FeaturesPage() {
  const { canAny } = useAuth();
  const allowed = canAny(['features.toggle', 'tariffs.manage']);

  const featuresQuery = useQuery({
    queryKey: ['features'],
    queryFn: () => api.features(),
    enabled: allowed,
  });

  if (!allowed) {
    return <EmptyState title="Нет доступа" hint="Требуется features.toggle или tariffs.manage" />;
  }

  return (
    <div>
      <PageHeader
        title="Фичи / тарифы"
        description="Матрица entitlements по тарифам Standard / Premium / Ultra."
      />

      <Panel>
        {featuresQuery.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-console-border text-xs uppercase tracking-wide text-console-muted">
                  <th className="pb-2 pr-3 font-medium">Фича</th>
                  {TARIFFS.map((t) => (
                    <th key={t} className="pb-2 pr-3 font-medium">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(featuresQuery.data ?? []).map((row) => (
                  <tr key={row.code} className="border-b border-console-border/60">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-console-text">{row.label}</div>
                      <div className="font-mono text-[11px] text-console-muted">{row.code}</div>
                    </td>
                    {TARIFFS.map((t) => (
                      <td key={t} className="py-2.5 pr-3">
                        <Badge tone={row.tariffs[t] ? 'success' : 'neutral'}>
                          {row.tariffs[t] ? 'on' : 'off'}
                        </Badge>
                      </td>
                    ))}
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
