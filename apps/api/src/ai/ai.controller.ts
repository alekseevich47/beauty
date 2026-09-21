import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AiService } from './ai.service';
import {
  CurrentUser,
  RequireFeature,
  Roles,
  type AuthUser,
} from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';
import { FeatureGuard } from '../common/guards/feature.guard';

@ZodSchema(z.object({ question: z.string().min(1).max(2000) }))
class AskDto {
  question!: string;
}

@Controller('ai')
@UseGuards(MiniAppAuthGuard, FeatureGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('motivation')
  @Roles('master')
  motivation(@CurrentUser() user: AuthUser) {
    return this.ai.motivational(user.masterId!);
  }

  @Get('clients/:clientId/analysis')
  @Roles('master')
  @RequireFeature('ai_client_analysis')
  analysis(@CurrentUser() user: AuthUser, @Param('clientId') clientId: string) {
    return this.ai.clientAnalysis(user.masterId!, clientId);
  }

  @Post('ask')
  @Roles('master')
  ask(@CurrentUser() user: AuthUser, @Body() body: AskDto) {
    return this.ai.ask(user.masterId!, body.question);
  }
}
