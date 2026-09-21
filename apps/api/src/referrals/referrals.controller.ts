import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ReferralsService } from './referrals.service';
import {
  CurrentUser,
  RequireFeature,
  Roles,
  type AuthUser,
} from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';

@ZodSchema(z.object({ code: z.string().min(4).max(32) }))
class ApplyReferralDto {
  code!: string;
}

@Controller('referrals')
@UseGuards(MiniAppAuthGuard, FeatureGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('code')
  @Roles('master')
  @RequireFeature('referrals')
  code(@CurrentUser() user: AuthUser) {
    return this.referrals.getOrCreateCode(user.masterId!);
  }

  @Post('apply')
  @Roles('master')
  @RequireFeature('referrals')
  apply(@CurrentUser() user: AuthUser, @Body() body: ApplyReferralDto) {
    return this.referrals.apply(user.masterId!, body.code);
  }
}
