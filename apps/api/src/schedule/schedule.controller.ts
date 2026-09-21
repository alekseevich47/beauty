import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { ScheduleService } from './schedule.service';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';

@ZodSchema(
  z.object({
    slots: z.array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
        slotStepMin: z.number().int().positive().optional(),
        timezone: z.string().optional(),
      }),
    ),
  }),
)
class UpsertScheduleDto {
  slots!: Array<{
    weekday: number;
    startTime: string;
    endTime: string;
    slotStepMin?: number;
    timezone?: string;
  }>;
}

@ZodSchema(
  z.object({
    date: z.string().date(),
    serviceId: z.string().uuid(),
  }),
)
class AvailabilityQueryDto {
  date!: string;
  serviceId!: string;
}

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Public()
  @Get(':masterId')
  get(@Param('masterId') masterId: string) {
    return this.schedule.getMasterSchedule(masterId);
  }

  @Public()
  @Get(':masterId/availability')
  availability(@Param('masterId') masterId: string, @Query() q: AvailabilityQueryDto) {
    return this.schedule.availableSlots(masterId, q.date, q.serviceId);
  }

  @Put()
  @UseGuards(MiniAppAuthGuard)
  @Roles('master')
  upsert(@CurrentUser() user: AuthUser, @Body() body: UpsertScheduleDto) {
    return this.schedule.upsertSlots(user.masterId!, body.slots);
  }
}
