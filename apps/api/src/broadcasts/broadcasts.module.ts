import { Module, forwardRef } from '@nestjs/common';
import { BroadcastsController } from './broadcasts.controller';
import { BroadcastsService } from './broadcasts.service';
import { MiniAppAuthModule } from '../auth/miniapp/miniapp-auth.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [MiniAppAuthModule, forwardRef(() => QueuesModule)],
  controllers: [BroadcastsController],
  providers: [BroadcastsService],
  exports: [BroadcastsService],
})
export class BroadcastsModule {}
