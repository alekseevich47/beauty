import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Db } from '@beauty/db';
import { masters, masterProfiles, services, users, blacklist, waitingList } from '@beauty/db';
import type Redis from 'ioredis';
import { DB, REDIS_CACHE } from '../common/tokens';

@Injectable()
export class MastersService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  async getPublic(masterId: string) {
    const cacheKey = `master:public:${masterId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const [master] = await this.db
      .select()
      .from(masters)
      .where(and(eq(masters.id, masterId), eq(masters.isActive, true)))
      .limit(1);
    if (!master) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Master not found' },
      });
    }
    const [profile] = await this.db
      .select()
      .from(masterProfiles)
      .where(eq(masterProfiles.masterId, masterId))
      .limit(1);
    const svc = await this.db
      .select()
      .from(services)
      .where(and(eq(services.masterId, masterId), eq(services.isActive, true)));

    const payload = {
      ...master,
      ratingAvg: Number(master.ratingAvg),
      profile,
      services: svc.map((s) => ({
        id: s.id,
        title: s.title,
        durationMin: s.durationMin,
        price: { amount: s.priceAmount, currency: 'RUB' as const },
        photoUrl: s.photoUrl,
        categoryId: s.categoryId,
      })),
    };
    await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 60);
    return payload;
  }

  async becomeMaster(userId: string, input: { cityId: string; displayName: string }) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'User not found' },
      });
    }
    const [existing] = await this.db
      .select()
      .from(masters)
      .where(eq(masters.userId, userId))
      .limit(1);
    if (existing) return existing;

    const [master] = await this.db
      .insert(masters)
      .values({
        userId,
        cityId: input.cityId,
        displayName: input.displayName,
        avatarUrl: user.avatarUrl,
        widgetPublicKey: randomBytes(16).toString('hex'),
        referralCode: randomBytes(6).toString('hex'),
      })
      .returning();

    await this.db.insert(masterProfiles).values({
      masterId: master!.id,
      deepLinkSlug: master!.id.slice(0, 8),
    });
    await this.db
      .update(users)
      .set({ role: 'master', updatedAt: new Date() })
      .where(eq(users.id, userId));

    return master;
  }

  async upsertService(
    masterId: string,
    input: {
      id?: string;
      categoryId: string;
      variantId?: string;
      title: string;
      description?: string;
      durationMin: number;
      priceAmount: number;
      photoUrl?: string;
    },
  ) {
    if (input.priceAmount < 0) {
      throw new BadRequestException({
        error: { code: 'BAD_PRICE', message: 'priceAmount must be >= 0' },
      });
    }
    if (input.id) {
      const [row] = await this.db
        .update(services)
        .set({
          categoryId: input.categoryId,
          variantId: input.variantId,
          title: input.title,
          description: input.description,
          durationMin: input.durationMin,
          priceAmount: input.priceAmount,
          photoUrl: input.photoUrl,
          updatedAt: new Date(),
        })
        .where(and(eq(services.id, input.id), eq(services.masterId, masterId)))
        .returning();
      return row;
    }
    const [row] = await this.db
      .insert(services)
      .values({
        masterId,
        categoryId: input.categoryId,
        variantId: input.variantId,
        title: input.title,
        description: input.description,
        durationMin: input.durationMin,
        priceAmount: input.priceAmount,
        photoUrl: input.photoUrl,
      })
      .returning();
    return row;
  }

  async addToBlacklist(masterId: string, clientId: string, reason?: string) {
    const [row] = await this.db
      .insert(blacklist)
      .values({ masterId, clientId, reason })
      .onConflictDoNothing()
      .returning();
    return row ?? { ok: true };
  }

  async joinWaitingList(
    masterId: string,
    clientId: string,
    serviceId?: string,
    preferredDate?: string,
  ) {
    const [row] = await this.db
      .insert(waitingList)
      .values({
        masterId,
        clientId,
        serviceId,
        preferredDate: preferredDate ? new Date(preferredDate) : null,
      })
      .returning();
    return row;
  }

  async masterOfWeek(cityId: string, categoryId?: string) {
    const cacheKey = `mow:${cityId}:${categoryId ?? 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const rows = await this.db.execute(sql`
      select m.id, m.display_name as "displayName", m.avatar_url as "avatarUrl",
             m.rating_avg as "ratingAvg", m.rating_count as "ratingCount",
             m.city_id as "cityId", m.tariff_code as "tariffCode",
             count(a.id)::int as "completedCount"
      from masters m
      left join appointments a on a.master_id = m.id
        and a.status = 'completed'
        and a.completed_at >= now() - interval '7 days'
      left join services s on s.master_id = m.id
      where m.city_id = ${cityId}::uuid and m.is_active = true
        ${categoryId ? sql`and s.category_id = ${categoryId}::uuid` : sql``}
      group by m.id
      order by "completedCount" desc, m.rating_avg desc
      limit 5
    `);

    const items = (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
      ...r,
      ratingAvg: Number(r.ratingAvg),
      isMasterOfWeek: true,
    }));
    await this.redis.set(cacheKey, JSON.stringify(items), 'EX', 600);
    return items;
  }

  async nearby(cityId: string, lat: number, lng: number, limit = 20) {
    return this.db.execute(sql`
      select m.*,
        (abs(cast(m.location_lat as float) - ${lat}) + abs(cast(m.location_lng as float) - ${lng})) as dist
      from masters m
      where m.city_id = ${cityId}::uuid and m.is_active = true
        and m.location_lat is not null
      order by dist
      limit ${limit}
    `);
  }
}

void desc;
