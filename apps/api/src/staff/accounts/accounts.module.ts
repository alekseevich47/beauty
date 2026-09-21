import { Module } from '@nestjs/common';
import { StaffAccountsController } from './accounts.controller';
import { StaffAccountsService } from './accounts.service';
import { StaffAuthModule } from '../../auth/staff/staff-auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StaffAuthModule, AuditModule],
  controllers: [StaffAccountsController],
  providers: [StaffAccountsService],
})
export class StaffAccountsModule {}
