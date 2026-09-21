import { Module } from '@nestjs/common';
import { StaffAuthController } from './staff-auth.controller';
import {
  StaffAuthService,
  StaffAuthGuard,
  PermissionsGuard,
} from '../../common/guards/staff-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Module({
  controllers: [StaffAuthController],
  providers: [StaffAuthService, StaffAuthGuard, PermissionsGuard, RateLimitGuard],
  exports: [StaffAuthService, StaffAuthGuard, PermissionsGuard, RateLimitGuard],
})
export class StaffAuthModule {}
