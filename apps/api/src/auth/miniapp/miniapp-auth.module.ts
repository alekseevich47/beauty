import { Module } from '@nestjs/common';
import { MiniAppAuthController } from './miniapp-auth.controller';
import { MiniAppJwtService, MiniAppAuthGuard } from '../../common/guards/miniapp-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { FeatureGuard } from '../../common/guards/feature.guard';

@Module({
  controllers: [MiniAppAuthController],
  providers: [MiniAppJwtService, MiniAppAuthGuard, RateLimitGuard, FeatureGuard],
  exports: [MiniAppJwtService, MiniAppAuthGuard, RateLimitGuard, FeatureGuard],
})
export class MiniAppAuthModule {}
