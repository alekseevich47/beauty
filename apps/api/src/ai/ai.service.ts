import { Inject, Injectable } from '@nestjs/common';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import { aiUsage } from '@beauty/db';
import type Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { APP_ENV, DB, REDIS_CACHE } from '../common/tokens';

export interface AiProvider {
  complete(prompt: string): Promise<{ text: string; tokensIn: number; tokensOut: number }>;
}

class NoopAiProvider implements AiProvider {
  async complete(prompt: string) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    return {
      text: `${greeting}! Сегодня отличный день для роста — ${prompt.slice(0, 40)}`.trim(),
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}

@Injectable()
export class AiService {
  private readonly provider: AiProvider;

  constructor(
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {
    this.provider = new NoopAiProvider();
    void this.env.AI_PROVIDER;
  }

  async motivational(masterId: string) {
    const prompt = 'motivational line for beauty master';
    const cacheKey = `ai:motivation:${masterId}:${new Date().toISOString().slice(0, 10)}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { text: cached, cached: true };

    const result = await this.provider.complete(prompt);
    await this.redis.set(cacheKey, result.text, 'EX', 3600);
    await this.db.insert(aiUsage).values({
      masterId,
      feature: 'motivation',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
    return { text: result.text, cached: false };
  }

  async clientAnalysis(masterId: string, clientId: string) {
    const hash = createHash('sha256').update(`${masterId}:${clientId}`).digest('hex').slice(0, 16);
    const cacheKey = `ai:analysis:${hash}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown;

    const result = await this.provider.complete(
      `Analyze client ${clientId} booking patterns for master ${masterId}`,
    );
    const payload = {
      summary: result.text,
      tips: ['Предложите удобный слот', 'Напомните о любимой услуге'],
    };
    await this.redis.set(cacheKey, JSON.stringify(payload), 'EX', 86400);
    await this.db.insert(aiUsage).values({
      masterId,
      feature: 'ai_client_analysis',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
    return payload;
  }

  async ask(masterId: string, question: string) {
    const result = await this.provider.complete(question);
    await this.db.insert(aiUsage).values({
      masterId,
      feature: 'ask',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
    return { answer: result.text };
  }
}
