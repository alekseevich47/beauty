import { Body, Controller, Inject, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { authInitDataSchema, refreshTokenSchema, type UserRole } from '@beauty/contracts';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import { users, masters } from '@beauty/db';
import {
  validateTelegramInitData,
  validateMaxInitData,
  initDataReplayKey,
} from '@beauty/platform/server';
import type Redis from 'ioredis';
import { APP_ENV, DB, REDIS_CACHE } from '../../common/tokens';
import { Public } from '../../common/decorators/auth.decorators';
import { ZodSchema } from '../../common/pipes/zod-validation.pipe';
import { RateLimit, RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { MiniAppJwtService, type TokenPair } from '../../common/guards/miniapp-auth.guard';

@ZodSchema(authInitDataSchema)
class AuthInitDto {
  platform!: 'telegram' | 'max';
  initData!: string;
  role?: UserRole;
}

@ZodSchema(refreshTokenSchema)
class RefreshDto {
  refreshToken!: string;
}

@Controller('auth')
@UseGuards(RateLimitGuard)
export class MiniAppAuthController {
  constructor(
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
    private readonly jwt: MiniAppJwtService,
  ) {}

  @Public()
  @Post('init')
  @RateLimit({ key: 'auth-init', limit: 30, windowSec: 60 })
  async init(@Body() body: AuthInitDto): Promise<TokenPair & { userId: string; role: UserRole }> {
    const hash = this.extractHash(body.initData);
    const replayKey = initDataReplayKey(body.platform, hash);
    const claimed = await this.redis.set(replayKey, '1', 'EX', this.env.INITDATA_MAX_AGE_SEC, 'NX');
    if (claimed !== 'OK') {
      throw new UnauthorizedException({
        error: { code: 'REPLAY', message: 'initData already used' },
      });
    }

    const validated = this.validate(body.platform, body.initData);
    if (!validated.ok) {
      await this.redis.del(replayKey);
      throw new UnauthorizedException({
        error: { code: 'INVALID_INITDATA', message: validated.reason },
      });
    }

    const role: UserRole = body.role === 'master' || body.role === 'client' ? body.role : 'client';

    let [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.platform, body.platform),
          eq(users.platformUserId, validated.user.platformUserId),
        ),
      )
      .limit(1);

    if (!user) {
      const displayName =
        [validated.user.firstName, validated.user.lastName].filter(Boolean).join(' ') ||
        validated.user.username ||
        'User';
      const [created] = await this.db
        .insert(users)
        .values({
          platform: body.platform,
          platformUserId: validated.user.platformUserId,
          role,
          displayName,
          username: validated.user.username,
          avatarUrl: validated.user.photoUrl,
          languageCode: validated.user.languageCode ?? 'ru',
        })
        .returning();
      user = created!;
    }

    let masterId: string | undefined;
    if (user.role === 'master') {
      const [m] = await this.db
        .select({ id: masters.id })
        .from(masters)
        .where(eq(masters.userId, user.id))
        .limit(1);
      masterId = m?.id;
    }

    const accessToken = await this.jwt.signAccess({
      sub: user.id,
      role: user.role,
      masterId,
    });
    const refresh = await this.jwt.issueRefresh(this.db, user.id);

    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: this.env.JWT_ACCESS_TTL_SEC,
      userId: user.id,
      role: user.role,
    };
  }

  @Public()
  @Post('refresh')
  @RateLimit({ key: 'auth-refresh', limit: 60, windowSec: 60 })
  async refresh(@Body() body: RefreshDto): Promise<TokenPair> {
    const rotated = await this.jwt.rotateRefresh(this.db, body.refreshToken);
    const [user] = await this.db.select().from(users).where(eq(users.id, rotated.userId)).limit(1);
    if (!user || user.isBlocked) {
      throw new UnauthorizedException({
        error: { code: 'USER_BLOCKED', message: 'User blocked' },
      });
    }
    let masterId: string | undefined;
    if (user.role === 'master') {
      const [m] = await this.db
        .select({ id: masters.id })
        .from(masters)
        .where(eq(masters.userId, user.id))
        .limit(1);
      masterId = m?.id;
    }
    const accessToken = await this.jwt.signAccess({
      sub: user.id,
      role: user.role,
      masterId,
    });
    return {
      accessToken,
      refreshToken: rotated.newToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SEC,
    };
  }

  private validate(platform: 'telegram' | 'max', initData: string) {
    if (platform === 'telegram') {
      if (!this.env.TELEGRAM_BOT_TOKEN) {
        return { ok: false as const, reason: 'telegram_not_configured' };
      }
      return validateTelegramInitData(
        initData,
        this.env.TELEGRAM_BOT_TOKEN,
        this.env.INITDATA_MAX_AGE_SEC,
      );
    }
    if (!this.env.MAX_PLATFORM_ENABLED || !this.env.MAX_BOT_TOKEN) {
      return { ok: false as const, reason: 'max_not_enabled' };
    }
    return validateMaxInitData(initData, this.env.MAX_BOT_TOKEN, this.env.INITDATA_MAX_AGE_SEC);
  }

  private extractHash(initData: string): string {
    const part = initData.split('&').find((p) => p.startsWith('hash='));
    const hash = part ? decodeURIComponent(part.slice(5)) : '';
    if (!hash) {
      return createHash('sha256').update(initData).digest('hex');
    }
    return hash;
  }
}
