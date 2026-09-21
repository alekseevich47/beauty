import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { StaffAuthModule } from '../../auth/staff/staff-auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StaffAuthModule, AuditModule],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}
