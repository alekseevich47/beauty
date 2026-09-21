import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { FeedService } from './feed.service';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';

@ZodSchema(
  z.object({
    title: z.string().max(200).optional(),
    body: z.string().min(1).max(10000),
    mediaUrl: z.string().url().optional(),
    publish: z.boolean().optional(),
  }),
)
class CreatePostDto {
  title?: string;
  body!: string;
  mediaUrl?: string;
  publish?: boolean;
}

@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Public()
  @Get(':masterId')
  get(@Param('masterId') masterId: string) {
    return this.feed.publicFeed(masterId);
  }

  @Post()
  @UseGuards(MiniAppAuthGuard)
  @Roles('master')
  create(@CurrentUser() user: AuthUser, @Body() body: CreatePostDto) {
    return this.feed.createPost(user.masterId!, body);
  }

  @Delete(':id')
  @UseGuards(MiniAppAuthGuard)
  @Roles('master')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.feed.deletePost(user.masterId!, id);
  }
}
