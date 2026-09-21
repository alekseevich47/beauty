import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AppConfigModule } from './common/config/app-config.module';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './common/health/health.module';
import { QueuesModule } from './queues/queues.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PinoLogger } from './common/logger/pino.logger';
import { MiniAppAuthGuard } from './common/guards/miniapp-auth.guard';
import { MiniAppAuthModule } from './auth/miniapp/miniapp-auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { BookingModule } from './booking/booking.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { FeedModule } from './feed/feed.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReferralsModule } from './referrals/referrals.module';
import { BroadcastsModule } from './broadcasts/broadcasts.module';
import { BillingModule } from './billing/billing.module';
import { FeaturesModule } from './features/features.module';
import { AiModule } from './ai/ai.module';
import { MastersModule } from './masters/masters.module';
import { WidgetModule } from './widget/widget.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { RealtimeModule } from './common/realtime/realtime.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    CryptoModule,
    RealtimeModule,
    HealthModule,
    QueuesModule,
    MiniAppAuthModule,
    CatalogModule,
    BookingModule,
    ScheduleModule,
    ReviewsModule,
    FavoritesModule,
    FeedModule,
    AnalyticsModule,
    NotificationsModule,
    ReferralsModule,
    BroadcastsModule,
    BillingModule,
    FeaturesModule,
    AiModule,
    MastersModule,
    WidgetModule,
  ],
  providers: [
    PinoLogger,
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: MiniAppAuthGuard },
  ],
})
export class MiniAppModule {}
