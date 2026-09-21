import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/AuthProvider';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Panel,
  Spinner,
} from '@/components/ui';
import { api } from '@/lib/api';
import type { OpsJob, OpsJobKind } from '@/types/staff';

const ACTIONS: Array<{
  kind: OpsJobKind;
  label: string;
  description: string;
  permission: 'ops.backup' | 'ops.restart';
  danger?: boolean;
}> = [
  {
    kind: 'backup',
    label: 'Ручной бэкап БД',
    description: 'Триггер WAL-G / pgBackRest → S3',
    permission: 'ops.backup',
  },
  {
    kind: 'restart_api',
    label: 'Перезапуск API',
    description: 'Rolling restart internal/miniapp API',
    permission: 'ops.restart',
    danger: true,
  },
  {
    kind: 'restart_db',
    label: 'Перезапуск БД',
    description: 'Только по согласованию; короткий downtime',
    permission: 'ops.restart',
    danger: true,
  },
  {
    kind: 'rebuild',
    label: 'Rebuild deploy',
    description: 'Хук CI/оркестратора',
    permission: 'ops.restart',
    danger: true,
  },
];

function statusTone(status: OpsJob['status']) {
  switch (status) {
    case 'succeeded':
    case 'dry_run':
      return 'success' as const;
    case 'failed':
      return 'danger' as const;
    case 'running':
      return 'info' as const;
    default:
      return 'warning' as const;
  }
}

export function OpsPage() {
  const { can } = useAuth();
  const [pending, setPending] = useState<{ kind: OpsJobKind; dryRun: boolean } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<OpsJob[]>([]);

  const canAnyOps = can('ops.backup') || can('ops.restart');

  const jobQuery = useQuery({
    queryKey: ['ops-job', activeJobId],
    queryFn: () => api.getOpsJob(activeJobId!),
    enabled: Boolean(activeJobId),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!status || status === 'succeeded' || status === 'failed' || status === 'dry_run') {
        return false;
      }
      return 1000;
    },
  });

  useEffect(() => {
    const job = jobQuery.data;
    if (!job) return;
    setHistory((prev) => {
      const without = prev.filter((j) => j.id !== job.id);
      return [job, ...without].slice(0, 12);
    });
  }, [jobQuery.data]);

  const createMutation = useMutation({
    mutationFn: ({ kind, dryRun }: { kind: OpsJobKind; dryRun: boolean }) =>
      api.createOpsJob(kind, dryRun),
    onSuccess: (job) => {
      setActiveJobId(job.id);
      setHistory((prev) => [job, ...prev.filter((j) => j.id !== job.id)].slice(0, 12));
    },
  });

  if (!canAnyOps) {
    return (
      <EmptyState title="Нет доступа к операциям" hint="Требуется ops.backup или ops.restart" />
    );
  }

  const confirmAction = ACTIONS.find((a) => a.kind === pending?.kind);

  return (
    <div>
      <PageHeader
        title="Операции"
        description="Опасные действия требуют подтверждения. Сначала dry-run, затем job polling."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Действия">
          <ul className="space-y-3">
            {ACTIONS.filter((a) => can(a.permission)).map((action) => (
              <li
                key={action.kind}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-console-border bg-console-bg/50 px-3 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-console-text">{action.label}</div>
                  <div className="text-xs text-console-muted">{action.description}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={createMutation.isPending}
                    onClick={() => setPending({ kind: action.kind, dryRun: true })}
                  >
                    Dry-run
                  </Button>
                  <Button
                    size="sm"
                    variant={action.danger ? 'danger' : 'primary'}
                    disabled={createMutation.isPending}
                    onClick={() => setPending({ kind: action.kind, dryRun: false })}
                  >
                    Запустить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Статус задачи">
          {!activeJobId ? (
            <EmptyState title="Нет активной задачи" hint="Запустите dry-run или операцию" />
          ) : jobQuery.isLoading && !jobQuery.data ? (
            <Spinner label="Опрос job…" />
          ) : jobQuery.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(jobQuery.data.status)}>{jobQuery.data.status}</Badge>
                <span className="font-mono text-xs text-console-muted">{jobQuery.data.id}</span>
                {jobQuery.data.dryRun ? <Badge tone="info">dry-run</Badge> : null}
              </div>
              <p className="text-sm text-console-text">{jobQuery.data.message}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs text-console-muted">
                <div>
                  <dt>kind</dt>
                  <dd className="font-mono text-console-text">{jobQuery.data.kind}</dd>
                </div>
                <div>
                  <dt>updated</dt>
                  <dd className="font-mono text-console-text">
                    {new Date(jobQuery.data.updatedAt).toLocaleString('ru-RU')}
                  </dd>
                </div>
              </dl>
              {jobQuery.data.status === 'queued' || jobQuery.data.status === 'running' ? (
                <Spinner label="Polling…" />
              ) : null}
            </div>
          ) : (
            <EmptyState title="Job не найден" />
          )}
        </Panel>
      </div>

      <Panel className="mt-4" title="История (сессия)">
        {history.length === 0 ? (
          <EmptyState title="Пока пусто" />
        ) : (
          <ul className="space-y-2">
            {history.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-console-border/50 py-2 text-sm last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  <span className="font-mono text-xs">{job.kind}</span>
                  {job.dryRun ? <span className="text-xs text-console-muted">dry-run</span> : null}
                </div>
                <span className="text-xs text-console-muted">{job.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.dryRun
            ? `Dry-run: ${confirmAction?.label ?? ''}`
            : `Подтвердите: ${confirmAction?.label ?? ''}`
        }
        body={
          pending?.dryRun
            ? 'Будет выполнена проверка без применения изменений. Результат попадёт в audit.'
            : 'Операция будет поставлена в очередь. Отменить после старта может быть нельзя.'
        }
        confirmLabel={pending?.dryRun ? 'Запустить dry-run' : 'Подтвердить'}
        danger={!pending?.dryRun && confirmAction?.danger}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          createMutation.mutate(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
