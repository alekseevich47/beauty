import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { supportThreads, supportMessages, masters, staffUsers } from '@beauty/db';
import { DB } from '../../common/tokens';
import { CentrifugoService } from '../../common/realtime/centrifugo.service';

export type ChatThreadDto = {
  id: string;
  masterId: string;
  masterName: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
};

export type ChatMessageDto = {
  id: string;
  threadId: string;
  author: 'staff' | 'master' | 'system';
  authorName: string;
  body: string;
  createdAt: string;
};

@Injectable()
export class StaffChatService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly centrifugo: CentrifugoService,
  ) {}

  async listThreads(status?: string): Promise<ChatThreadDto[]> {
    const rows = await this.db
      .select({
        id: supportThreads.id,
        masterId: supportThreads.masterId,
        masterName: masters.displayName,
        status: supportThreads.status,
        updatedAt: supportThreads.updatedAt,
      })
      .from(supportThreads)
      .innerJoin(masters, eq(masters.id, supportThreads.masterId))
      .where(status ? eq(supportThreads.status, status) : undefined)
      .orderBy(desc(supportThreads.updatedAt))
      .limit(50);

    return Promise.all(
      rows.map(async (t) => {
        const [last] = await this.db
          .select({
            body: supportMessages.body,
            senderStaffId: supportMessages.senderStaffId,
          })
          .from(supportMessages)
          .where(eq(supportMessages.threadId, t.id))
          .orderBy(desc(supportMessages.createdAt))
          .limit(1);

        // "Unread" for staff = trailing messages from the master with no staff reply after
        const unread = last && !last.senderStaffId ? 1 : 0;

        return {
          id: t.id,
          masterId: t.masterId,
          masterName: t.masterName,
          lastMessage: last?.body ?? '',
          unread,
          updatedAt: t.updatedAt.toISOString(),
        };
      }),
    );
  }

  async getMessages(threadId: string): Promise<ChatMessageDto[]> {
    const rows = await this.db
      .select({
        id: supportMessages.id,
        threadId: supportMessages.threadId,
        body: supportMessages.body,
        createdAt: supportMessages.createdAt,
        senderStaffId: supportMessages.senderStaffId,
        senderUserId: supportMessages.senderUserId,
        staffName: staffUsers.displayName,
      })
      .from(supportMessages)
      .leftJoin(staffUsers, eq(staffUsers.id, supportMessages.senderStaffId))
      .where(eq(supportMessages.threadId, threadId))
      .orderBy(asc(supportMessages.createdAt));

    return rows.map((m) => ({
      id: m.id,
      threadId: m.threadId,
      author: m.senderStaffId ? 'staff' : m.senderUserId ? 'master' : 'system',
      authorName: m.staffName ?? (m.senderUserId ? 'Мастер' : 'Система'),
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Subscription token scoped to a single thread channel. */
  async realtimeToken(
    threadId: string,
    staffId: string,
  ): Promise<{ token: string | null; channel: string }> {
    const channel = CentrifugoService.supportThreadChannel(threadId);
    const token = await this.centrifugo.issueConnectionToken(`staff:${staffId}`, [channel]);
    return { token, channel };
  }

  async reply(threadId: string, staffId: string, body: string): Promise<ChatMessageDto> {
    const [thread] = await this.db
      .select()
      .from(supportThreads)
      .where(eq(supportThreads.id, threadId))
      .limit(1);
    if (!thread) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Thread not found' },
      });
    }

    const [msg] = await this.db
      .insert(supportMessages)
      .values({ threadId, senderStaffId: staffId, body })
      .returning();

    await this.db
      .update(supportThreads)
      .set({ assignedStaffId: staffId, updatedAt: new Date() })
      .where(eq(supportThreads.id, threadId));

    const [staff] = await this.db
      .select({ displayName: staffUsers.displayName })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffId))
      .limit(1);

    const dto: ChatMessageDto = {
      id: msg!.id,
      threadId,
      author: 'staff',
      authorName: staff?.displayName ?? 'Поддержка',
      body: msg!.body,
      createdAt: msg!.createdAt.toISOString(),
    };

    await this.centrifugo.publish(CentrifugoService.supportThreadChannel(threadId), dto);

    return dto;
  }

  async assign(threadId: string, staffId: string) {
    const [row] = await this.db
      .update(supportThreads)
      .set({ assignedStaffId: staffId, updatedAt: new Date() })
      .where(eq(supportThreads.id, threadId))
      .returning();
    return row;
  }
}
