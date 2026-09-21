import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { BroadcastsService } from './broadcasts.service';
import {
  CurrentUser,
  RequireFeature,
  Roles,
  type AuthUser,
} from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';

@ZodSchema(
  z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
    scheduledAt: z.string().datetime().optional(),
  }),
)
class CreateBroadcastDto {
  title!: string;
  body!: string;
  scheduledAt?: string;
}

@Controller('broadcasts')
@UseGuards(MiniAppAuthGuard, FeatureGuard)
export class BroadcastsController {
  constructor(private readonly broadcasts: BroadcastsService) {}

  @Get()
  @Roles('master')
  @RequireFeature('broadcast_monthly')
  list(@CurrentUser() user: AuthUser) {
    return this.broadcasts.list(user.masterId!);
  }

  @Post()
  @Roles('master')
  @RequireFeature('broadcast_monthly')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBroadcastDto) {
    return this.broadcasts.create(user.masterId!, body);
  }
}
