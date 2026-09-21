import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { MastersService } from './masters.service';
import {
  CurrentUser,
  Public,
  RequireFeature,
  Roles,
  type AuthUser,
} from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';

@ZodSchema(
  z.object({
    cityId: z.string().uuid(),
    displayName: z.string().min(1).max(160),
  }),
)
class BecomeMasterDto {
  cityId!: string;
  displayName!: string;
}

@ZodSchema(
  z.object({
    id: z.string().uuid().optional(),
    categoryId: z.string().uuid(),
    variantId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    durationMin: z.number().int().positive(),
    priceAmount: z.number().int().nonnegative(),
    photoUrl: z.string().url().optional(),
  }),
)
class UpsertServiceDto {
  id?: string;
  categoryId!: string;
  variantId?: string;
  title!: string;
  description?: string;
  durationMin!: number;
  priceAmount!: number;
  photoUrl?: string;
}

@Controller('masters')
export class MastersController {
  constructor(private readonly masters: MastersService) {}

  @Public()
  @Get('of-week')
  ofWeek(@Query('cityId') cityId: string, @Query('categoryId') categoryId?: string) {
    return this.masters.masterOfWeek(cityId, categoryId);
  }

  @Public()
  @Get('nearby')
  nearby(@Query('cityId') cityId: string, @Query('lat') lat: string, @Query('lng') lng: string) {
    return this.masters.nearby(cityId, Number(lat), Number(lng));
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.masters.getPublic(id);
  }

  @Post('become')
  @UseGuards(MiniAppAuthGuard)
  become(@CurrentUser() user: AuthUser, @Body() body: BecomeMasterDto) {
    return this.masters.becomeMaster(user.id, body);
  }

  @Put('me/services')
  @UseGuards(MiniAppAuthGuard)
  @Roles('master')
  upsertService(@CurrentUser() user: AuthUser, @Body() body: UpsertServiceDto) {
    return this.masters.upsertService(user.masterId!, body);
  }

  @Post('me/blacklist')
  @UseGuards(MiniAppAuthGuard, FeatureGuard)
  @Roles('master')
  @RequireFeature('blacklist')
  blacklist(@CurrentUser() user: AuthUser, @Body() body: { clientId: string; reason?: string }) {
    return this.masters.addToBlacklist(user.masterId!, body.clientId, body.reason);
  }

  @Post(':id/waiting-list')
  @UseGuards(MiniAppAuthGuard, FeatureGuard)
  @RequireFeature('waiting_list')
  waitingList(
    @CurrentUser() user: AuthUser,
    @Param('id') masterId: string,
    @Body() body: { serviceId?: string; preferredDate?: string },
  ) {
    return this.masters.joinWaitingList(masterId, user.id, body.serviceId, body.preferredDate);
  }
}
