import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { createReviewSchema } from '@beauty/contracts';
import { z } from 'zod';
import { ReviewsService } from './reviews.service';
import { CurrentUser, Roles, type AuthUser } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';

@ZodSchema(createReviewSchema)
class CreateReviewDto {
  appointmentId!: string;
  rating!: number;
  text?: string;
}

@Controller('reviews')
@UseGuards(MiniAppAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post('master')
  @Roles('client')
  reviewMaster(@CurrentUser() user: AuthUser, @Body() body: CreateReviewDto) {
    return this.reviews.reviewMaster({
      clientId: user.id,
      appointmentId: body.appointmentId,
      rating: body.rating,
      text: body.text,
    });
  }

  @Post('client')
  @Roles('master')
  reviewClient(@CurrentUser() user: AuthUser, @Body() body: CreateReviewDto) {
    return this.reviews.reviewClient({
      masterId: user.masterId!,
      appointmentId: body.appointmentId,
      rating: body.rating,
      text: body.text,
    });
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    if (user.role === 'master' && user.masterId) {
      return this.reviews.listForMaster(user.masterId);
    }
    return this.reviews.listForClient(user.id);
  }
}

void z;
