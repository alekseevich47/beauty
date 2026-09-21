import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { revenuePeriodSchema } from '@beauty/contracts';
import { z } from 'zod';
import { AnalyticsService } from './analytics.service';
import {
  CurrentUser,
  RequireFeature,
  Roles,
  type AuthUser,
} from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';

@ZodSchema(z.object({ period: revenuePeriodSchema.default('day') }))
class RevenueQueryDto {
  period!: 'day' | 'week' | 'month';
}

@Controller('analytics')
@UseGuards(MiniAppAuthGuard, FeatureGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('revenue')
  @Roles('master')
  @RequireFeature('analytics_basic')
  revenue(@CurrentUser() user: AuthUser, @Query() q: RevenueQueryDto) {
    return this.analytics.revenue(user.masterId!, q.period ?? 'day');
  }
}
