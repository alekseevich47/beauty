import { Module } from '@nestjs/common';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { MiniAppAuthModule } from '../auth/miniapp/miniapp-auth.module';

@Module({
  imports: [MiniAppAuthModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
