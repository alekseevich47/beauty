import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';

@Controller('staff/audit')
@UseGuards(StaffAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  list(@Query('limit') limit?: string) {
    return this.audit.list(limit ? Number(limit) : 50);
  }

  @Get(':entityType/:entityId')
  @RequirePermission('audit.read')
  byEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.audit.byEntity(entityType, entityId);
  }
}
