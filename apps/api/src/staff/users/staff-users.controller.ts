import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { StaffUsersService } from './staff-users.service';
import {
  CurrentStaff,
  RequirePermission,
  type StaffAuth,
  type StaffRoleName,
} from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';
import { AuditService } from '../audit/audit.service';

@ZodSchema(
  z.object({
    email: z.string().email(),
    password: z.string().min(12).max(128),
    displayName: z.string().min(2).max(160),
    role: z.enum(['admin', 'support']),
  }),
)
class CreateStaffDto {
  email!: string;
  password!: string;
  displayName!: string;
  role!: StaffRoleName;
}

@ZodSchema(z.object({ active: z.boolean() }))
class ActiveDto {
  active!: boolean;
}

@Controller('staff/users')
@UseGuards(StaffAuthGuard, PermissionsGuard)
export class StaffUsersController {
  constructor(
    private readonly users: StaffUsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission('staff.manage')
  list() {
    return this.users.list();
  }

  @Post()
  @RequirePermission('staff.manage')
  async create(@Body() body: CreateStaffDto, @CurrentStaff() staff: StaffAuth) {
    const created = await this.users.create(body);
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'staff.create',
      entityType: 'staff_user',
      entityId: created.id,
      after: { email: created.email, role: body.role },
    });
    return created;
  }

  @Patch(':id/active')
  @RequirePermission('staff.manage')
  async setActive(
    @Param('id') id: string,
    @Body() body: ActiveDto,
    @CurrentStaff() staff: StaffAuth,
  ) {
    const result = await this.users.setActive(id, body.active);
    await this.audit.write({
      actorStaffId: staff.id,
      action: body.active ? 'staff.activate' : 'staff.deactivate',
      entityType: 'staff_user',
      entityId: id,
      after: { active: body.active },
    });
    return result;
  }

  @Post(':id/totp-reset')
  @RequirePermission('staff.manage')
  async resetTotp(@Param('id') id: string, @CurrentStaff() staff: StaffAuth) {
    const result = await this.users.resetTotp(id);
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'staff.totp_reset',
      entityType: 'staff_user',
      entityId: id,
    });
    return result;
  }
}
