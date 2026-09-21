import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { subscribeSchema } from '@beauty/contracts';
import { BillingService } from './billing.service';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';
import { RateLimit, RateLimitGuard } from '../common/guards/rate-limit.guard';

@ZodSchema(subscribeSchema)
class SubscribeDto {
  tariffCode!: 'standard' | 'premium' | 'ultra';
  returnUrl?: string;
}

@Controller('billing')
@UseGuards(RateLimitGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('subscribe')
  @UseGuards(MiniAppAuthGuard)
  @Roles('master')
  @RateLimit({ key: 'payments', limit: 10, windowSec: 60 })
  subscribe(@CurrentUser() user: AuthUser, @Body() body: SubscribeDto) {
    return this.billing.subscribe(user.masterId!, body.tariffCode, body.returnUrl);
  }

  @Get('subscription')
  @UseGuards(MiniAppAuthGuard)
  @Roles('master')
  subscription(@CurrentUser() user: AuthUser) {
    return this.billing.currentSubscription(user.masterId!);
  }

  @Public()
  @Post('webhooks/yookassa')
  @RateLimit({ key: 'payments-webhook', limit: 120, windowSec: 60 })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-content-hmac') signature: string | undefined,
  ) {
    const raw =
      typeof req.rawBody === 'string'
        ? req.rawBody
        : Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString('utf8')
          : JSON.stringify(req.body);
    return this.billing.handleWebhook(raw, signature);
  }
}
