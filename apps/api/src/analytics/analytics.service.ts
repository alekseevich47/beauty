import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { appointments } from '@beauty/db';
import type { revenuePeriodSchema } from '@beauty/contracts';
import type { z } from 'zod';
import { DB } from '../common/tokens';
import { RequireFeature } from '../common/decorators/auth.decorators';

type Period = z.infer<typeof revenuePeriodSchema>;

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async revenue(masterId: string, period: Period) {
    const now = new Date();
    const { start, prevStart, prevEnd, bucket } = this.bounds(now, period);

    const current = await this.sumRevenue(masterId, start, now);
    const previous = await this.sumRevenue(masterId, prevStart, prevEnd);

    const deltaPercent =
      previous === 0
        ? current === 0
          ? 0
          : 100
        : Number((((current - previous) / previous) * 100).toFixed(2));

    const direction =
      deltaPercent > 0 ? ('up' as const) : deltaPercent < 0 ? ('down' as const) : ('flat' as const);

    const seriesRows = await this.db.execute(sql`
      select date_trunc(${bucket}, starts_at) as t,
             coalesce(sum(price_amount), 0)::int as v
      from appointments
      where master_id = ${masterId}::uuid
        and status = 'completed'
        and starts_at >= ${start}
        and starts_at < ${now}
      group by 1
      order by 1
    `);

    const series = (seriesRows as unknown as Array<{ t: Date; v: number }>).map((r) => ({
      t: new Date(r.t).toISOString(),
      v: Number(r.v),
    }));

    return {
      period,
      amount: current,
      currency: 'RUB' as const,
      deltaPercent,
      direction,
      series,
    };
  }

  private async sumRevenue(masterId: string, from: Date, to: Date): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<number>`coalesce(sum(${appointments.priceAmount}), 0)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.masterId, masterId),
          eq(appointments.status, 'completed'),
          gte(appointments.startsAt, from),
          lt(appointments.startsAt, to),
        ),
      );
    return Number(row?.total ?? 0);
  }

  private bounds(now: Date, period: Period) {
    const start = new Date(now);
    const prevStart = new Date(now);
    const prevEnd = new Date(now);
    let bucket = 'hour';

    if (period === 'day') {
      start.setUTCHours(0, 0, 0, 0);
      prevEnd.setTime(start.getTime());
      prevStart.setTime(start.getTime() - 86400_000);
      bucket = 'hour';
    } else if (period === 'week') {
      const day = start.getUTCDay();
      const diff = (day + 6) % 7;
      start.setUTCDate(start.getUTCDate() - diff);
      start.setUTCHours(0, 0, 0, 0);
      prevEnd.setTime(start.getTime());
      prevStart.setTime(start.getTime() - 7 * 86400_000);
      bucket = 'day';
    } else {
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      prevEnd.setTime(start.getTime());
      prevStart.setUTCFullYear(start.getUTCFullYear(), start.getUTCMonth() - 1, 1);
      prevStart.setUTCHours(0, 0, 0, 0);
      bucket = 'day';
    }
    return { start, prevStart, prevEnd, bucket };
  }
}

void RequireFeature;
