import { Global, Module, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { Env } from '@beauty/config';
import { APP_ENV, REDIS_CACHE, REDIS_QUEUE } from '../tokens';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CACHE,
      inject: [APP_ENV],
      useFactory: (env: Env) =>
        new Redis(env.REDIS_CACHE_URL, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        }),
    },
    {
      provide: REDIS_QUEUE,
      inject: [APP_ENV],
      useFactory: (env: Env) =>
        new Redis(env.REDIS_QUEUE_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        }),
    },
  ],
  exports: [REDIS_CACHE, REDIS_QUEUE],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CACHE) private readonly cache: Redis,
    @Inject(REDIS_QUEUE) private readonly queue: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.cache.quit(), this.queue.quit()]);
  }
}
