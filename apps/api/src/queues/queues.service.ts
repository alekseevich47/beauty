import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { REDIS_QUEUE } from '../common/tokens';
import { QUEUE_NAMES } from './queue-names';

@Injectable()
export class QueuesService implements OnModuleDestroy {
  readonly reminders: Queue;
  readonly reviews: Queue;
  readonly broadcasts: Queue;
  readonly subscriptionDunning: Queue;
  readonly masterOfWeek: Queue;
  readonly mvRefresh: Queue;

  private readonly all: Queue[];

  constructor(@Inject(REDIS_QUEUE) redis: Redis) {
    const connection = redis.duplicate();
    const opts = { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 } };

    this.reminders = new Queue(QUEUE_NAMES.reminders, opts);
    this.reviews = new Queue(QUEUE_NAMES.reviews, opts);
    this.broadcasts = new Queue(QUEUE_NAMES.broadcasts, opts);
    this.subscriptionDunning = new Queue(QUEUE_NAMES.subscriptionDunning, opts);
    this.masterOfWeek = new Queue(QUEUE_NAMES.masterOfWeek, opts);
    this.mvRefresh = new Queue(QUEUE_NAMES.mvRefresh, opts);

    this.all = [
      this.reminders,
      this.reviews,
      this.broadcasts,
      this.subscriptionDunning,
      this.masterOfWeek,
      this.mvRefresh,
    ];
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(this.all.map((q) => q.close()));
  }
}
