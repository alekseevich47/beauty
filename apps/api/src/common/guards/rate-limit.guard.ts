import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { REDIS_CACHE } from '../tokens';

export const RATE_LIMIT_KEY = 'beauty:rate_limit';

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowSec: number;
  /**
   * Extra bucket dimension read from the request (e.g. a widget publishable key),
   * so a single key cannot be spread across many source addresses.
   */
  subject?: (req: Request) => string | undefined;
};

export const RateLimit = (opts: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, opts);

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = Reflect.getMetadata(RATE_LIMIT_KEY, context.getHandler()) as
      RateLimitOptions | undefined;
    if (!opts) return true;

    const req = context.switchToHttp().getRequest<Request>();
    // `req.ip` honours Express `trust proxy`, which is configured from
    // TRUSTED_PROXY_HOPS. Never parse X-Forwarded-For by hand: a client can send
    // that header itself and would then control its own rate-limit bucket.
    const ip = req.ip ?? 'unknown';
    const subject = opts.subject?.(req);
    const bucket = subject ? `rl:${opts.key}:${subject}` : `rl:${opts.key}:${ip}`;
    const count = await this.redis.incr(bucket);
    if (count === 1) {
      await this.redis.expire(bucket, opts.windowSec);
    }
    if (count > opts.limit) {
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
