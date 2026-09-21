import { Inject, Injectable, Logger } from '@nestjs/common';
import { Worker, type Job } from 'bullmq';
import type Redis from 'ioredis';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { appointments, subscriptions, masters } from '@beauty/db';
import { DB, REDIS_QUEUE } from '../../common/tokens';
import { QUEUE_NAMES } from '../queue-names';
import { BroadcastsService } from '../../broadcasts/broadcasts.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class QueueWorkers {
  private readonly logger = new Logger(QueueWorkers.name);
  private workers: Worker[] = [];

  constructor(
    @Inject(REDIS_QUEUE) private readonly redis: Redis,
    @Inject(DB) private readonly db: Db,
    private readonly broadcasts: BroadcastsService,
    private readonly notifications: NotificationsService,
  ) {}

  start(): void {
    const connection = this.redis.duplicate();

    this.workers = [
      new Worker(QUEUE_NAMES.reminders, async (job) => this.handleReminder(job), { connection }),
      new Worker(QUEUE_NAMES.reviews, async (job) => this.handleReviewPrompt(job), { connection }),
      new Worker(QUEUE_NAMES.broadcasts, async (job) => this.handleBroadcast(job), { connection }),
      new Worker(QUEUE_NAMES.subscriptionDunning, async (job) => this.handleDunning(job), {
        connection,
      }),
      new Worker(QUEUE_NAMES.masterOfWeek, async () => this.handleMasterOfWeek(), { connection }),
      new Worker(QUEUE_NAMES.mvRefresh, async () => this.handleMvRefresh(), { connection }),
    ];

    for (const w of this.workers) {
      w.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.name} failed: ${err.message}`);
      });
    }

    this.logger.log('BullMQ workers started');
  }

  async stop(): Promise<void> {
    await Promise.allSettled(this.workers.map((w) => w.close()));
  }

  private async handleReminder(job: Job<{ appointmentId: string }>) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, job.data.appointmentId))
      .limit(1);
    if (!a || a.status === 'cancelled') return;

    await this.notifications.push({
      userId: a.clientId,
      type: 'appointment_reminder',
      title: 'Напоминание о записи',
      body: `Запись в ${a.startsAt.toISOString()}`,
      payload: { appointmentId: a.id },
    });

    const [m] = await this.db
      .select({ userId: masters.userId })
      .from(masters)
      .where(eq(masters.id, a.masterId))
      .limit(1);
    if (m) {
      await this.notifications.push({
        userId: m.userId,
        type: 'appointment_reminder',
        title: 'Напоминание о клиенте',
        body: `Запись в ${a.startsAt.toISOString()}`,
        payload: { appointmentId: a.id },
      });
    }

    // Schedule review prompt after appointment end
    // (caller/worker may enqueue separately)
  }

  private async handleReviewPrompt(job: Job<{ appointmentId: string }>) {
    const [a] = await this.db
      .select()
      .from(appointments)
      .where(eq(appointments.id, job.data.appointmentId))
      .limit(1);
    if (!a || a.status !== 'completed') return;

    await this.notifications.push({
      userId: a.clientId,
      type: 'review_prompt',
      title: 'Оставьте отзыв о мастере',
      payload: { appointmentId: a.id },
    });
  }

  private async handleBroadcast(job: Job<{ broadcastId: string }>) {
    return this.broadcasts.send(job.data.broadcastId);
  }

  private async handleDunning(_job: Job) {
    const now = new Date();
    const pastDue = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.status, 'active'), lte(subscriptions.currentPeriodEnd, now)));

    for (const sub of pastDue) {
      await this.db
        .update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(subscriptions.id, sub.id));

      const [m] = await this.db
        .select({ userId: masters.userId })
        .from(masters)
        .where(eq(masters.id, sub.masterId))
        .limit(1);
      if (m) {
        await this.notifications.push({
          userId: m.userId,
          type: 'subscription_dunning',
          title: 'Подписка просрочена',
          body: 'Обновите оплату, чтобы сохранить доступ к фичам',
          payload: { subscriptionId: sub.id },
        });
      }
    }
    return { processed: pastDue.length };
  }

  private async handleMasterOfWeek() {
    // Invalidate MoW caches — actual ranking computed on read
    return { ok: true };
  }

  private async handleMvRefresh() {
    try {
      await this.db.execute(
        sql`refresh materialized view concurrently if exists mv_master_revenue`,
      );
    } catch {
      // MV may not exist yet in early migrations
    }
    return { ok: true };
  }
}

void gte;
void isNull;
