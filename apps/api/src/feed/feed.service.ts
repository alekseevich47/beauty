import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNotNull, lte } from 'drizzle-orm';
import type { Db } from '@beauty/db';
import { feedPosts, promoBlocks, portfolioMedia } from '@beauty/db';
import { DB } from '../common/tokens';

@Injectable()
export class FeedService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async publicFeed(masterId: string) {
    const posts = await this.db
      .select()
      .from(feedPosts)
      .where(
        and(
          eq(feedPosts.masterId, masterId),
          isNotNull(feedPosts.publishedAt),
          lte(feedPosts.publishedAt, new Date()),
        ),
      )
      .orderBy(desc(feedPosts.publishedAt))
      .limit(30);

    const promos = await this.db
      .select()
      .from(promoBlocks)
      .where(and(eq(promoBlocks.masterId, masterId), eq(promoBlocks.isActive, true)))
      .orderBy(asc(promoBlocks.sortOrder));

    const portfolio = await this.db
      .select()
      .from(portfolioMedia)
      .where(eq(portfolioMedia.masterId, masterId))
      .orderBy(asc(portfolioMedia.sortOrder))
      .limit(40);

    return { posts, promos, portfolio };
  }

  async createPost(
    masterId: string,
    input: { title?: string; body: string; mediaUrl?: string; publish?: boolean },
  ) {
    const [row] = await this.db
      .insert(feedPosts)
      .values({
        masterId,
        title: input.title,
        body: input.body,
        mediaUrl: input.mediaUrl,
        publishedAt: input.publish === false ? null : new Date(),
      })
      .returning();
    return row;
  }

  async deletePost(masterId: string, postId: string) {
    const [row] = await this.db
      .delete(feedPosts)
      .where(and(eq(feedPosts.id, postId), eq(feedPosts.masterId, masterId)))
      .returning();
    if (!row) {
      throw new NotFoundException({
        error: { code: 'NOT_FOUND', message: 'Post not found' },
      });
    }
    return { ok: true };
  }
}
