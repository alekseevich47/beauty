import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import { opsJobs } from '@beauty/db';
import { APP_ENV, DB } from '../../common/tokens';
import { AuditService } from '../audit/audit.service';

export type OpsJobKind = 'backup' | 'restart_api' | 'restart_db' | 'rebuild';
export type OpsJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dry_run';

export type OpsJobDto = {
  id: string;
  kind: OpsJobKind;
  dryRun: boolean;
  status: OpsJobStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type MetricPoint = {
  t: string;
  cpu: number;
  memory: number;
  rps: number;
  p95ms: number;
};

type PrometheusMatrix = {
  data?: { result?: { values?: [number, string][] }[] };
};

const KIND_TO_TYPE: Record<OpsJobKind, string> = {
  backup: 'backup',
  restart_api: 'restart:api',
  restart_db: 'restart:db',
  rebuild: 'rebuild',
};

const TYPE_TO_KIND: Record<string, OpsJobKind> = {
  backup: 'backup',
  'restart:api': 'restart_api',
  'restart:db': 'restart_db',
  rebuild: 'rebuild',
};

@Injectable()
export class OpsService {
  constructor(
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  private toDto(row: typeof opsJobs.$inferSelect): OpsJobDto {
    const result = row.result as { message?: string } | null;
    return {
      id: row.id,
      kind: TYPE_TO_KIND[row.type] ?? 'backup',
      dryRun: row.dryRun,
      status: (row.dryRun && row.status === 'succeeded' ? 'dry_run' : row.status) as OpsJobStatus,
      message: row.error ?? result?.message ?? row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: (row.finishedAt ?? row.startedAt ?? row.createdAt).toISOString(),
      finishedAt: row.finishedAt?.toISOString() ?? null,
    };
  }

  async listJobs(): Promise<OpsJobDto[]> {
    const rows = await this.db.select().from(opsJobs).orderBy(desc(opsJobs.createdAt)).limit(50);
    return rows.map((r) => this.toDto(r));
  }

  async getJob(id: string): Promise<OpsJobDto> {
    const [row] = await this.db.select().from(opsJobs).where(eq(opsJobs.id, id)).limit(1);
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Ops job not found' },
      });
    }
    return this.toDto(row);
  }

  /**
   * Single entry point for ops jobs. Every job is persisted and audited before any
   * side effect, and a job is only marked succeeded once the remote hook confirms it.
   */
  async createJob(staffId: string, kind: OpsJobKind, dryRun: boolean): Promise<OpsJobDto> {
    const type = KIND_TO_TYPE[kind];
    if (!type) {
      throw new BadRequestException({
        error: { code: 'UNKNOWN_JOB', message: 'Unknown ops job kind' },
      });
    }

    const [job] = await this.db
      .insert(opsJobs)
      .values({ type, status: 'queued', requestedBy: staffId, dryRun, payload: { kind } })
      .returning();

    await this.audit.write({
      actorStaffId: staffId,
      action: kind === 'backup' ? 'ops.backup' : 'ops.restart',
      entityType: 'ops_job',
      entityId: job!.id,
      metadata: { kind, dryRun },
    });

    if (dryRun) {
      return this.finish(job!.id, 'succeeded', {
        message: `Dry run accepted for ${kind}; no side effects executed`,
      });
    }

    const hook =
      kind === 'backup'
        ? { url: this.env.BACKUP_TRIGGER_URL, token: this.env.BACKUP_TRIGGER_TOKEN }
        : { url: this.env.RESTART_TRIGGER_URL, token: this.env.RESTART_TRIGGER_TOKEN };

    if (!hook.url || !hook.token) {
      await this.finish(job!.id, 'failed', undefined, `${kind} hook not configured`);
      throw new ServiceUnavailableException({
        error: {
          code: 'OPS_HOOK_UNAVAILABLE',
          message: `Ops hook for ${kind} is not configured`,
        },
      });
    }

    await this.db
      .update(opsJobs)
      .set({ status: 'running', startedAt: new Date() })
      .where(eq(opsJobs.id, job!.id));

    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hook.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job!.id, kind }),
      });
      const text = await res.text().catch(() => '');
      if (!res.ok) {
        return this.finish(
          job!.id,
          'failed',
          { status: res.status },
          `Hook responded ${res.status}: ${text.slice(0, 200)}`,
        );
      }
      return this.finish(job!.id, 'succeeded', {
        status: res.status,
        message: text.slice(0, 200) || `${kind} accepted by orchestrator`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown error';
      return this.finish(job!.id, 'failed', undefined, message);
    }
  }

  private async finish(
    jobId: string,
    status: 'succeeded' | 'failed',
    result?: Record<string, unknown>,
    error?: string,
  ): Promise<OpsJobDto> {
    const [row] = await this.db
      .update(opsJobs)
      .set({ status, result: result ?? null, error: error ?? null, finishedAt: new Date() })
      .where(eq(opsJobs.id, jobId))
      .returning();
    return this.toDto(row!);
  }

  /**
   * Metrics are proxied through the API so the browser never talks to Prometheus
   * directly. Falls back to local process stats when Prometheus is unreachable.
   */
  async metrics(): Promise<MetricPoint[]> {
    if (!this.env.PROMETHEUS_URL) return this.localMetrics();

    const end = Math.floor(Date.now() / 1000);
    const start = end - 3600;
    const step = 60;

    const queries = {
      cpu: '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))',
      memory: '100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)',
      rps: 'sum(rate(http_requests_total[5m]))',
      p95ms:
        '1000 * histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
    } as const;

    try {
      const series = await Promise.all(
        Object.entries(queries).map(async ([name, query]) => {
          const url = new URL('/api/v1/query_range', this.env.PROMETHEUS_URL);
          url.searchParams.set('query', query);
          url.searchParams.set('start', String(start));
          url.searchParams.set('end', String(end));
          url.searchParams.set('step', String(step));
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          if (!res.ok) throw new Error(`prometheus ${res.status}`);
          const body = (await res.json()) as PrometheusMatrix;
          const values = body.data?.result?.[0]?.values ?? [];
          return [name, new Map(values.map(([t, v]) => [t, Number(v)]))] as const;
        }),
      );

      const byName = Object.fromEntries(series);
      const timestamps = [...(byName.cpu?.keys() ?? [])];

      return timestamps.map((t) => ({
        t: new Date(t * 1000).toISOString(),
        cpu: round(byName.cpu?.get(t)),
        memory: round(byName.memory?.get(t)),
        rps: round(byName.rps?.get(t)),
        p95ms: round(byName.p95ms?.get(t)),
      }));
    } catch {
      return this.localMetrics();
    }
  }

  private localMetrics(): MetricPoint[] {
    const mem = process.memoryUsage();
    return [
      {
        t: new Date().toISOString(),
        cpu: 0,
        memory: round((mem.heapUsed / mem.heapTotal) * 100),
        rps: 0,
        p95ms: 0,
      },
    ];
  }
}

function round(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
}
