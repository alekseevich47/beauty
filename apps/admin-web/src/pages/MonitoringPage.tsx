import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/auth/AuthProvider';
import { EmptyState, PageHeader, Panel, Spinner } from '@/components/ui';
import { api } from '@/lib/api';

export function MonitoringPage() {
  const { can } = useAuth();

  const metricsQuery = useQuery({
    queryKey: ['ops-metrics'],
    queryFn: () => api.metrics(),
    enabled: can('ops.metrics'),
    refetchInterval: 30_000,
  });

  if (!can('ops.metrics')) {
    return <EmptyState title="Нет доступа к мониторингу" hint="Требуется ops.metrics" />;
  }

  const points = metricsQuery.data ?? [];
  const latest = points[points.length - 1];

  const chartData = points.map((p) => ({
    ...p,
    label: new Date(p.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  }));

  return (
    <div>
      <PageHeader
        title="Мониторинг"
        description="Агрегированные метрики (Prometheus proxy в production)."
      />

      {metricsQuery.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'CPU %', value: latest?.cpu ?? '—' },
              { label: 'Memory %', value: latest?.memory ?? '—' },
              { label: 'RPS', value: latest?.rps ?? '—' },
              { label: 'p95 ms', value: latest?.p95ms ?? '—' },
            ].map((card) => (
              <Panel key={card.label} flush>
                <div className="px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-console-muted">
                    {card.label}
                  </div>
                  <div className="mt-1 font-mono text-2xl font-semibold text-console-text">
                    {card.value}
                  </div>
                </div>
              </Panel>
            ))}
          </div>

          <Panel title="24h trends">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#2a3544" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#8b98a8" fontSize={11} />
                  <YAxis stroke="#8b98a8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: '#121820',
                      border: '1px solid #2a3544',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    stroke="#2f6fed"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    stroke="#1f9d63"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="rps"
                    stroke="#3a8fbf"
                    dot={false}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="p95ms"
                    stroke="#c48a1a"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
