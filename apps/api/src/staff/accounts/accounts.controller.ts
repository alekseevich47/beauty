import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { StaffAccountsService } from './accounts.service';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';
import { AuditService } from '../audit/audit.service';
import { CurrentStaff, type StaffAuth } from '../../common/decorators/auth.decorators';

@ZodSchema(z.object({ q: z.string().min(1).max(100) }))
class SearchQueryDto {
  q!: string;
}

@ZodSchema(
  z.object({
    q: z.string().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
)
class ListQueryDto {
  q?: string;
  limit!: number;
}

@Controller('staff/accounts')
@UseGuards(StaffAuthGuard, PermissionsGuard)
export class StaffAccountsController {
  constructor(
    private readonly accounts: StaffAccountsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermission('accounts.read')
  list(@Query() query: ListQueryDto) {
    return this.accounts.list(query.q, query.limit);
  }

  @Get('search')
  @RequirePermission('accounts.read')
  search(@Query() query: SearchQueryDto) {
    return this.accounts.search(query.q);
  }

  @Get('users/:id')
  @RequirePermission('accounts.read')
  getUser(@Param('id') id: string) {
    return this.accounts.getUser(id);
  }

  @Get('masters/:id')
  @RequirePermission('accounts.read')
  getMaster(@Param('id') id: string) {
    return this.accounts.getMaster(id);
  }

  @Patch('users/:id/block')
  @RequirePermission('accounts.write')
  async block(
    @Param('id') id: string,
    @Body() body: { isBlocked: boolean },
    @CurrentStaff() staff: StaffAuth,
  ) {
    const before = await this.accounts.getUser(id);
    const after = await this.accounts.setBlocked(id, body.isBlocked);
    await this.audit.write({
      actorStaffId: staff.id,
      action: body.isBlocked ? 'user.block' : 'user.unblock',
      entityType: 'user',
      entityId: id,
      before: { isBlocked: before.user.isBlocked },
      after: { isBlocked: after?.isBlocked },
    });
    return after;
  }

  @Patch('masters/:id/active')
  @RequirePermission('accounts.write')
  async setActive(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentStaff() staff: StaffAuth,
  ) {
    const before = await this.accounts.getMaster(id);
    const after = await this.accounts.setMasterActive(id, body.isActive);
    await this.audit.write({
      actorStaffId: staff.id,
      action: 'master.set_active',
      entityType: 'master',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: after?.isActive },
    });
    return after;
  }
}
