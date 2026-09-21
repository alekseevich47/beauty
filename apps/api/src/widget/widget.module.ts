import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';
import { MiniAppAuthModule } from '../auth/miniapp/miniapp-auth.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [MiniAppAuthModule, BookingModule],
  controllers: [WidgetController],
  providers: [WidgetService],
})
export class WidgetModule {}
