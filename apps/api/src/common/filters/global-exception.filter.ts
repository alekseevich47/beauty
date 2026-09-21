import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { PinoLogger } from '../logger/pino.logger';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof body === 'object' && body && 'error' in body
        ? body
        : {
            error: {
              code:
                status >= 500
                  ? 'INTERNAL_ERROR'
                  : ((body as { message?: string })?.message ?? 'ERROR'),
              message:
                typeof body === 'string'
                  ? body
                  : ((body as { message?: string })?.message ??
                    (exception instanceof Error ? exception.message : 'Unexpected error')),
              requestId: req.id,
            },
          };

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    res.status(status).json(message);
  }
}
