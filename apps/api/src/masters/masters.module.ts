import { Module } from '@nestjs/common';
import { MastersController } from './masters.controller';
import { MastersService } from './masters.service';
import { MiniAppAuthModule } from '../auth/miniapp/miniapp-auth.module';

@Module({
  imports: [MiniAppAuthModule],
  controllers: [MastersController],
  providers: [MastersService],
  exports: [MastersService],
})
export class MastersModule {}
