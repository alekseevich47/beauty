import { Module } from '@nestjs/common';
import { QueueWorkers } from './processors/queue-workers';
import { QueuesModule } from './queues.module';
import { BroadcastsModule } from '../broadcasts/broadcasts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppConfigModule } from '../common/config/app-config.module';
import { DatabaseModule } from '../common/database/database.module';
import { RedisModule } from '../common/redis/redis.module';
import { PinoLogger } from '../common/logger/pino.logger';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    QueuesModule,
    BroadcastsModule,
    NotificationsModule,
  ],
  providers: [QueueWorkers, PinoLogger],
  exports: [QueueWorkers],
})
export class WorkerModule {}
