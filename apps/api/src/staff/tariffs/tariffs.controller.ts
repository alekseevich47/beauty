import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { featureCodeSchema, tariffCodeSchema } from '@beauty/contracts';
import { StaffTariffsService } from './tariffs.service';
import {
  CurrentStaff,
  RequirePermission,
  type StaffAuth,
} from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';
import { AuditService } from '../audit/audit.service';

@ZodSchema(z.object({ priceAmount: z.number().int().nonnegative() }))
class PriceDto {
  priceAmount!: number;
}

@ZodSchema(
  z.object({
    featureCode: featureCodeSchema,
    enabled: z.boolean(),
  }),
)
class OverrideDto {
  featureCode!: z.infer<typeof featureCodeSchema>;
  enabled!: boolean;
}

@Controller('staff/tariffs')
@UseGuards(StaffAuthGuard, PermissionsGuard)
export class StaffTariffsController {
  constructor(
    private readonly tariffs: StaffTariffsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission('tariffs.manage')
  list() {
    return this.tariffs.listTariffs();
  }

  @Get('features')
  @RequirePermission('features.toggle')
  features() {
    return this.tariffs.listFeatures();
  }

  @Patch(':code/price')
  @RequirePermission('tariffs.manage')
  async setPrice(
    @Param('code') code: string,
    @Body() body: PriceDto,
    @CurrentStaff() staff: StaffAuth,
  ) {
    const parsed = tariffCodeSchema.parse(code);
    const row = await this.tariffs.setTariffPrice(parsed, body.priceAmount);
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'tariff.set_price',
      entityType: 'tariff',
      entityId: parsed,
      after: { priceAmount: body.priceAmount },
    });
    return row;
  }

  @Post('masters/:masterId/override')
  @RequirePermission('features.toggle')
  async override(
    @Param('masterId') masterId: string,
    @Body() body: OverrideDto,
    @CurrentStaff() staff: StaffAuth,
  ) {
    const row = await this.tariffs.setMasterOverride(masterId, body.featureCode, body.enabled);
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'feature.override',
      entityType: 'master',
      entityId: masterId,
      after: { featureCode: body.featureCode, enabled: body.enabled },
    });
    return row;
  }

  @Post('masters/:masterId/assign')
  @RequirePermission('tariffs.manage')
  async assign(
    @Param('masterId') masterId: string,
    @Body() body: { tariffCode: z.infer<typeof tariffCodeSchema> },
    @CurrentStaff() staff: StaffAuth,
  ) {
    const tariffCode = tariffCodeSchema.parse(body.tariffCode);
    const row = await this.tariffs.assignMasterTariff(masterId, tariffCode);
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'tariff.assign',
      entityType: 'master',
      entityId: masterId,
      after: { tariffCode },
    });
    return row;
  }

  @Post('sync-matrix')
  @RequirePermission('tariffs.manage')
  sync() {
    return this.tariffs.syncMatrix();
  }
}
