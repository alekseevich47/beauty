import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { MiniAppAuthModule } from '../auth/miniapp/miniapp-auth.module';

@Module({
  imports: [MiniAppAuthModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
