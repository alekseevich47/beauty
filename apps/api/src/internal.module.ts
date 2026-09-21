import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AppConfigModule } from './common/config/app-config.module';
import { DatabaseModule } from './common/database/database.module';
import { RedisModule } from './common/redis/redis.module';
import { HealthModule } from './common/health/health.module';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PinoLogger } from './common/logger/pino.logger';
import { StaffAuthGuard, PermissionsGuard } from './common/guards/staff-auth.guard';
import { StaffAuthModule } from './auth/staff/staff-auth.module';
import { StaffAccountsModule } from './staff/accounts/accounts.module';
import { StaffChatModule } from './staff/chat/chat.module';
import { OpsModule } from './staff/ops/ops.module';
import { AuditModule } from './staff/audit/audit.module';
import { StaffTariffsModule } from './staff/tariffs/tariffs.module';
import { StaffUsersModule } from './staff/users/staff-users.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { CryptoModule } from './common/crypto/crypto.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    RealtimeModule,
    CryptoModule,
    HealthModule,
    StaffAuthModule,
    StaffAccountsModule,
    StaffChatModule,
    StaffUsersModule,
    OpsModule,
    AuditModule,
    StaffTariffsModule,
  ],
  providers: [
    PinoLogger,
    { provide: APP_PIPE, useFactory: () => new ZodValidationPipe() },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: StaffAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class InternalModule {}
