import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { CurrentUser, Roles, type AuthUser } from '../common/decorators/auth.decorators';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';

@Controller('features')
@UseGuards(MiniAppAuthGuard)
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get('me')
  @Roles('master')
  me(@CurrentUser() user: AuthUser) {
    return this.features.forMaster(user.masterId!);
  }
}
