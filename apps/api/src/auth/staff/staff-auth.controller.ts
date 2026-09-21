import { Controller, Body, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { staffLoginSchema, staffTotpSchema } from '@beauty/contracts';
import { Public, CurrentStaff, type StaffAuth } from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { RateLimit, RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { StaffAuthGuard, StaffAuthService } from '../../common/guards/staff-auth.guard';

@ZodSchema(staffLoginSchema)
class StaffLoginDto {
  email!: string;
  password!: string;
}

@ZodSchema(staffTotpSchema)
class StaffTotpDto {
  challengeId!: string;
  code!: string;
}

function toSessionResponse(staff: StaffAuth) {
  return {
    user: {
      id: staff.id,
      email: staff.email,
      displayName: staff.displayName,
      roles: staff.roles,
      permissions: staff.permissions,
    },
  };
}

@Controller('staff/auth')
@UseGuards(RateLimitGuard)
export class StaffAuthController {
  constructor(private readonly staffAuth: StaffAuthService) {}

  @Public()
  @Post('login')
  @RateLimit({ key: 'staff-login', limit: 10, windowSec: 60 })
  async login(@Body() body: StaffLoginDto) {
    return this.staffAuth.loginStep1(body.email, body.password);
  }

  @Public()
  @Post('totp')
  @RateLimit({ key: 'staff-totp', limit: 10, windowSec: 60 })
  async totp(
    @Body() body: StaffTotpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.staffAuth.loginStep2(body.challengeId, body.code, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.staffAuth.setSessionCookie(res, result.token);
    return toSessionResponse(result.staff);
  }

  @Get('session')
  @UseGuards(StaffAuthGuard)
  session(@CurrentStaff() staff: StaffAuth) {
    return toSessionResponse(staff);
  }

  @Post('logout')
  @UseGuards(StaffAuthGuard)
  async logout(@CurrentStaff() staff: StaffAuth, @Res({ passthrough: true }) res: Response) {
    await this.staffAuth.logout(staff.sessionId);
    this.staffAuth.clearSessionCookie(res);
    return { ok: true };
  }
}
