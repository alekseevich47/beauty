import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { StaffChatService } from './chat.service';
import {
  CurrentStaff,
  RequirePermission,
  type StaffAuth,
} from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';

@ZodSchema(z.object({ body: z.string().min(1).max(10000) }))
class ReplyDto {
  body!: string;
}

@Controller('staff/chat')
@UseGuards(StaffAuthGuard, PermissionsGuard)
export class StaffChatController {
  constructor(private readonly chat: StaffChatService) {}

  @Get('threads')
  @RequirePermission('chat.read')
  threads(@Query('status') status?: string) {
    return this.chat.listThreads(status);
  }

  @Get('threads/:id/messages')
  @RequirePermission('chat.read')
  messages(@Param('id') id: string) {
    return this.chat.getMessages(id);
  }

  @Get('threads/:id/realtime-token')
  @RequirePermission('chat.read')
  realtimeToken(@Param('id') id: string, @CurrentStaff() staff: StaffAuth) {
    return this.chat.realtimeToken(id, staff.id);
  }

  @Post('threads/:id/messages')
  @RequirePermission('chat.write')
  send(@Param('id') id: string, @Body() body: ReplyDto, @CurrentStaff() staff: StaffAuth) {
    return this.chat.reply(id, staff.id, body.body);
  }

  @Post('threads/:id/assign')
  @RequirePermission('chat.write')
  assign(@Param('id') id: string, @CurrentStaff() staff: StaffAuth) {
    return this.chat.assign(id, staff.id);
  }
}
