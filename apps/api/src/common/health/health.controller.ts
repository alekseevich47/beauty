import { Controller, Get, Inject, Req, Res, Header } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import type Redis from 'ioredis';
import { sql } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { APP_ENV, DB, REDIS_CACHE } from '../tokens';
import { Public } from '../decorators/auth.decorators';
import { register } from '../metrics/metrics.registry';

const startedAt = Date.now();

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Controller()
export class HealthController {
  constructor(
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  @Public()
  @Get('healthz')
  healthz() {
    return {
      status: 'ok' as const,
      version: process.env.npm_package_version ?? '0.0.1',
      contour: this.env.API_CONTOUR,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    };
  }

  @Public()
  @Get('readyz')
  async readyz(@Res({ passthrough: true }) res: Response) {
    let dbOk = false;
    let redisOk = false;
    try {
      await this.db.execute(sql`select 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }
    try {
      const pong = await this.redis.ping();
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    const ready = dbOk && redisOk;
    if (!ready) res.status(503);
    return {
      status: ready ? ('ok' as const) : ('down' as const),
      version: process.env.npm_package_version ?? '0.0.1',
      contour: this.env.API_CONTOUR,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      checks: { database: dbOk, redis: redisOk },
    };
  }
}

@Controller('metrics')
export class MetricsController {
  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!this.env.METRICS_TOKEN || !constantTimeEquals(token, this.env.METRICS_TOKEN)) {
      res.status(401);
      return 'unauthorized\n';
    }
    return register.metrics();
  }
}
