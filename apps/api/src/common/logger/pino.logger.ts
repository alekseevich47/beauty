import { Injectable, Inject, LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';
import type { Env } from '@beauty/config';
import { APP_ENV } from '../tokens';

@Injectable()
export class PinoLogger implements LoggerService {
  private readonly logger: Logger;

  constructor(@Inject(APP_ENV) env: Env) {
    this.logger = pino({
      name: env.APP_NAME,
      level: env.LOG_LEVEL,
      base: { contour: env.API_CONTOUR },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info({ ctx: optionalParams }, String(message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error({ ctx: optionalParams }, String(message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn({ ctx: optionalParams }, String(message));
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug({ ctx: optionalParams }, String(message));
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace({ ctx: optionalParams }, String(message));
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }
}
