import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, lte, sql, ilike } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { cities, categories, serviceVariants, services, masters } from '@beauty/db';
import type { catalogQuerySchema } from '@beauty/contracts';
import type { z } from 'zod';
import type Redis from 'ioredis';
import { DB, REDIS_CACHE } from '../common/tokens';

type CatalogQuery = z.infer<typeof catalogQuerySchema>;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  async listCities() {
    const cacheKey = 'catalog:cities';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;
    const rows = await this.db.select().from(cities).orderBy(asc(cities.name));
    await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', 300);
    return rows;
  }

  async listCategories() {
    const cacheKey = 'catalog:categories';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;
    const rows = await this.db
      .select()
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', 300);
    return rows;
  }

  async listVariants(categoryId?: string) {
    if (categoryId) {
      return this.db
        .select()
        .from(serviceVariants)
        .where(eq(serviceVariants.categoryId, categoryId))
        .orderBy(asc(serviceVariants.sortOrder));
    }
    return this.db.select().from(serviceVariants).orderBy(asc(serviceVariants.sortOrder));
  }

  async searchServices(query: CatalogQuery) {
    const conditions = [
      eq(services.isActive, true),
      eq(masters.isActive, true),
      eq(masters.cityId, query.cityId),
    ];
    if (query.categoryId) conditions.push(eq(services.categoryId, query.categoryId));
    if (query.variantId) conditions.push(eq(services.variantId, query.variantId));
    if (query.minPrice != null) conditions.push(gte(services.priceAmount, query.minPrice));
    if (query.maxPrice != null) conditions.push(lte(services.priceAmount, query.maxPrice));
    if (query.minRating != null) {
      conditions.push(sql`cast(${masters.ratingAvg} as numeric) >= ${query.minRating}`);
    }
    if (query.q) conditions.push(ilike(services.title, `%${query.q}%`));

    const limit = query.limit ?? 20;
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;

    const rows = await this.db
      .select({
        id: services.id,
        title: services.title,
        durationMin: services.durationMin,
        priceAmount: services.priceAmount,
        photoUrl: services.photoUrl,
        categoryId: services.categoryId,
        masterId: masters.id,
        displayName: masters.displayName,
        avatarUrl: masters.avatarUrl,
        ratingAvg: masters.ratingAvg,
        ratingCount: masters.ratingCount,
        cityId: masters.cityId,
        tariffCode: masters.tariffCode,
      })
      .from(services)
      .innerJoin(masters, eq(masters.id, services.masterId))
      .where(and(...conditions))
      .orderBy(desc(masters.ratingAvg), asc(services.priceAmount))
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        durationMin: r.durationMin,
        price: { amount: r.priceAmount, currency: 'RUB' as const },
        photoUrl: r.photoUrl,
        categoryId: r.categoryId,
        master: {
          id: r.masterId,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
          ratingAvg: Number(r.ratingAvg),
          ratingCount: r.ratingCount,
          cityId: r.cityId,
          tariffCode: r.tariffCode,
        },
      })),
      nextCursor: rows.length === limit ? String(offset + limit) : null,
    };
  }

  async popularVariants(cityId: string) {
    return this.db.execute(sql`
      select sv.id, sv.name, sv.cover_url as "coverUrl",
             count(distinct s.master_id)::int as "masterCount"
      from service_variants sv
      left join services s on s.variant_id = sv.id and s.is_active = true
      left join masters m on m.id = s.master_id and m.city_id = ${cityId}::uuid and m.is_active = true
      group by sv.id
      order by "masterCount" desc, sv.sort_order
      limit 20
    `);
  }
}
