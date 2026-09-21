import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { featureCodeSchema, tariffCodeSchema } from '@beauty/contracts';
import { StaffTariffsService } from '../tariffs/tariffs.service';
import {
  CurrentStaff,
  RequirePermission,
  type StaffAuth,
} from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';
import { AuditService } from '../audit/audit.service';

@ZodSchema(
  z.object({
    tariffCode: tariffCodeSchema,
    featureCode: featureCodeSchema,
    enabled: z.boolean(),
  }),
)
class ToggleDto {
  tariffCode!: z.infer<typeof tariffCodeSchema>;
  featureCode!: z.infer<typeof featureCodeSchema>;
  enabled!: boolean;
}

@Controller('staff/features')
@UseGuards(StaffAuthGuard, PermissionsGuard)
export class StaffFeaturesController {
  constructor(
    private readonly tariffs: StaffTariffsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission('features.toggle')
  matrix() {
    return this.tariffs.featureMatrix();
  }

  @Patch()
  @RequirePermission('features.toggle')
  async toggle(@Body() body: ToggleDto, @CurrentStaff() staff: StaffAuth) {
    const result = await this.tariffs.setTariffFeature(
      body.tariffCode,
      body.featureCode,
      body.enabled,
    );
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'features.toggle',
      entityType: 'tariff',
      entityId: body.tariffCode,
      after: { featureCode: body.featureCode, enabled: body.enabled },
    });
    return result;
  }
}
