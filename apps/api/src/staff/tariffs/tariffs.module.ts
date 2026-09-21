import { Module } from '@nestjs/common';
import { StaffTariffsController } from './tariffs.controller';
import { StaffFeaturesController } from '../features/staff-features.controller';
import { StaffTariffsService } from './tariffs.service';
import { StaffAuthModule } from '../../auth/staff/staff-auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [StaffAuthModule, AuditModule],
  controllers: [StaffTariffsController, StaffFeaturesController],
  providers: [StaffTariffsService],
})
export class StaffTariffsModule {}
