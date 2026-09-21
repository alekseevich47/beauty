import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { auditLogs } from '@beauty/db';
import { DB } from '../../common/tokens';

@Injectable()
export class AuditService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async write(input: {
    actorStaffId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    ip?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    const [row] = await this.db
      .insert(auditLogs)
      .values({
        actorStaffId: input.actorStaffId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ip: input.ip,
        before: input.before,
        after: input.after,
        metadata: input.metadata ?? {},
      })
      .returning();
    return row;
  }

  async list(limit = 50) {
    return this.db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async byEntity(entityType: string, entityId: string) {
    return this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.entityType, entityType))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100)
      .then((rows) => rows.filter((r) => r.entityId === entityId));
  }
}
