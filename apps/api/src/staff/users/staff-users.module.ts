import { Module } from '@nestjs/common';
import { StaffUsersController } from './staff-users.controller';
import { StaffUsersService } from './staff-users.service';
import { StaffAuthService } from '../../common/guards/staff-auth.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [StaffUsersController],
  providers: [StaffUsersService, StaffAuthService],
  exports: [StaffUsersService],
})
export class StaffUsersModule {}
