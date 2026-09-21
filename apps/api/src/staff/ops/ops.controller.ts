import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { OpsService, type OpsJobKind } from './ops.service';
import {
  CurrentStaff,
  RequirePermission,
  type StaffAuth,
} from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { StaffAuthGuard, PermissionsGuard } from '../../common/guards/staff-auth.guard';
import { RateLimit, RateLimitGuard } from '../../common/guards/rate-limit.guard';

@ZodSchema(
  z.object({
    kind: z.enum(['backup', 'restart_api', 'restart_db', 'rebuild']),
    dryRun: z.boolean().default(false),
  }),
)
class CreateJobDto {
  kind!: OpsJobKind;
  dryRun!: boolean;
}

@Controller('staff/ops')
@UseGuards(StaffAuthGuard, PermissionsGuard, RateLimitGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get('metrics')
  @RequirePermission('ops.metrics')
  metrics() {
    return this.ops.metrics();
  }

  @Get('jobs')
  @RequirePermission('ops.metrics')
  jobs() {
    return this.ops.listJobs();
  }

  @Get('jobs/:id')
  @RequirePermission('ops.metrics')
  job(@Param('id') id: string) {
    return this.ops.getJob(id);
  }

  /**
   * Backup needs `ops.backup`; anything that restarts infrastructure needs
   * `ops.restart`. The permission is picked from the requested job kind, so a
   * support account can never reach either path.
   */
  @Post('jobs')
  @RequirePermission('ops.metrics')
  @RateLimit({ key: 'staff-ops', limit: 5, windowSec: 60 })
  createJob(@CurrentStaff() staff: StaffAuth, @Body() body: CreateJobDto) {
    const required = body.kind === 'backup' ? 'ops.backup' : 'ops.restart';
    if (!staff.permissions.includes(required)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: `Missing permission ${required}` },
      });
    }
    return this.ops.createJob(staff.id, body.kind, body.dryRun ?? false);
  }
}
