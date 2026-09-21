import { Global, Module } from '@nestjs/common';
import { loadEnv, type Env } from '@beauty/config';
import { APP_ENV } from '../tokens';

@Global()
@Module({
  providers: [
    {
      provide: APP_ENV,
      useFactory: (): Env => loadEnv(),
    },
  ],
  exports: [APP_ENV],
})
export class AppConfigModule {}
