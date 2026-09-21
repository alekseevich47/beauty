import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { BROADCAST_LIMITS } from '@beauty/entitlements';
import type { Db } from '@beauty/db';
import { broadcasts, masters, appointments, users } from '@beauty/db';
import { DB } from '../common/tokens';
import { QueuesService } from '../queues/queues.service';
import { FeatureGuard } from '../common/guards/feature.guard';

@Injectable()
export class BroadcastsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly queues: QueuesService,
    private readonly features: FeatureGuard,
  ) {}

  async create(masterId: string, input: { title: string; body: string; scheduledAt?: string }) {
    const snapshot = await this.features.loadSnapshot(masterId);
    const limit = BROADCAST_LIMITS[snapshot.tariffCode]?.perMonth ?? 1;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [countRow] = await this.db
      .select({ c: sql<number>`count(*)::int` })
      .from(broadcasts)
      .where(and(eq(broadcasts.masterId, masterId), gte(broadcasts.createdAt, monthStart)));

    if (Number(countRow?.c ?? 0) >= limit) {
      throw new ForbiddenException({
        error: {
          code: 'BROADCAST_LIMIT',
          message: `Monthly broadcast limit (${limit}) reached`,
        },
      });
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException({
        error: { code: 'BAD_SCHEDULE', message: 'Invalid scheduledAt' },
      });
    }

    const [row] = await this.db
      .insert(broadcasts)
      .values({
        masterId,
        title: input.title,
        body: input.body,
        scheduledAt,
      })
      .returning();

    const delay = scheduledAt ? Math.max(scheduledAt.getTime() - Date.now(), 0) : 0;

    await this.queues.broadcasts.add('send-broadcast', { broadcastId: row!.id }, { delay });

    return row;
  }

  async list(masterId: string) {
    return this.db
      .select()
      .from(broadcasts)
      .where(eq(broadcasts.masterId, masterId))
      .orderBy(desc(broadcasts.createdAt));
  }

  /** Used by worker */
  async send(broadcastId: string) {
    const [b] = await this.db
      .select()
      .from(broadcasts)
      .where(eq(broadcasts.id, broadcastId))
      .limit(1);
    if (!b || b.sentAt) return { skipped: true };

    const clients = await this.db
      .selectDistinct({ clientId: appointments.clientId })
      .from(appointments)
      .where(eq(appointments.masterId, b.masterId));

    await this.db
      .update(broadcasts)
      .set({
        sentAt: new Date(),
        recipientCount: clients.length,
        updatedAt: new Date(),
      })
      .where(eq(broadcasts.id, broadcastId));

    return { sent: clients.length };
  }
}

void masters;
void users;
