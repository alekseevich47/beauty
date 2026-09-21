import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { MiniAppAuthModule } from '../auth/miniapp/miniapp-auth.module';

@Module({
  imports: [MiniAppAuthModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
