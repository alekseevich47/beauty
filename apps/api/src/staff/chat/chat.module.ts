import { Module } from '@nestjs/common';
import { StaffChatController } from './chat.controller';
import { StaffChatService } from './chat.service';
import { StaffAuthModule } from '../../auth/staff/staff-auth.module';

@Module({
  imports: [StaffAuthModule],
  controllers: [StaffChatController],
  providers: [StaffChatService],
})
export class StaffChatModule {}
