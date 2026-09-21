import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { favorites, masters, services } from '@beauty/db';
import { DB } from '../common/tokens';

@Injectable()
export class FavoritesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string) {
    const rows = await this.db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    return Promise.all(
      rows.map(async (f) => {
        const master = f.masterId
          ? (await this.db.select().from(masters).where(eq(masters.id, f.masterId)).limit(1))[0]
          : null;
        const service = f.serviceId
          ? (await this.db.select().from(services).where(eq(services.id, f.serviceId)).limit(1))[0]
          : null;
        return { ...f, master, service };
      }),
    );
  }

  async add(userId: string, masterId?: string, serviceId?: string) {
    if (!masterId && !serviceId) {
      throw new BadRequestException({
        error: { code: 'INVALID', message: 'masterId or serviceId required' },
      });
    }
    const [row] = await this.db
      .insert(favorites)
      .values({ userId, masterId, serviceId })
      .onConflictDoNothing()
      .returning();
    return row ?? { ok: true };
  }

  async remove(userId: string, id: string) {
    await this.db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, userId)));
    return { ok: true };
  }
}

void isNotNull;
void isNull;
