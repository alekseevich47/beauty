import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { notifications } from '@beauty/db';
import { DB } from '../common/tokens';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async markRead(userId: string, id: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { ok: true };
  }

  async push(input: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    payload?: Record<string, unknown>;
  }) {
    const [row] = await this.db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
      })
      .returning();
    return row;
  }
}
