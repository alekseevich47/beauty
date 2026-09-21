import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createAppointmentSchema, idParamSchema } from '@beauty/contracts';
import { BookingService } from './booking.service';
import { CurrentUser, Roles, type AuthUser } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { MiniAppAuthGuard } from '../common/guards/miniapp-auth.guard';

@ZodSchema(createAppointmentSchema)
class CreateAppointmentDto {
  serviceId!: string;
  masterId!: string;
  startsAt!: string;
  note?: string;
}

@ZodSchema(idParamSchema)
class IdParamDto {
  id!: string;
}

@Controller('bookings')
@UseGuards(MiniAppAuthGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Post()
  @Roles('client')
  create(@CurrentUser() user: AuthUser, @Body() body: CreateAppointmentDto) {
    return this.booking.create({
      clientId: user.id,
      serviceId: body.serviceId,
      masterId: body.masterId,
      startsAt: body.startsAt,
      note: body.note,
    });
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.booking.listForUser(user.id, user.role, user.masterId);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param() params: IdParamDto) {
    return this.booking.cancel(params.id, user.id, user.role === 'master');
  }

  @Post(':id/confirm')
  @Roles('master')
  confirm(@CurrentUser() user: AuthUser, @Param() params: IdParamDto) {
    return this.booking.confirm(params.id, user.id, user.masterId!);
  }
}
