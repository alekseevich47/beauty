import { Global, Module, Inject, OnModuleDestroy } from '@nestjs/common';
import { createDb, type Db } from '@beauty/db';
import type { Env } from '@beauty/config';
import { APP_ENV, DB } from '../tokens';

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [APP_ENV],
      useFactory: (env: Env): Db =>
        createDb(env.DATABASE_URL, {
          max: env.DATABASE_POOL_MAX,
          ssl: env.DATABASE_SSL,
        }),
    },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(DB) private readonly db: Db) {}

  async onModuleDestroy(): Promise<void> {
    // postgres.js client is closed via drizzle internal session when process exits
    void this.db;
  }
}
