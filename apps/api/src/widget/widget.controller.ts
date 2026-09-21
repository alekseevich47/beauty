import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { WidgetService } from './widget.service';
import { Public } from '../common/decorators/auth.decorators';
import { ZodSchema } from '../common/pipes/zod-validation.pipe';
import { RateLimit, RateLimitGuard } from '../common/guards/rate-limit.guard';

@ZodSchema(
  z.object({
    publicKey: z.string().min(8).max(64),
    serviceId: z.string().uuid(),
    clientName: z.string().min(2).max(80),
    phone: z.string().min(10).max(20),
    startsAt: z.string().datetime(),
    note: z.string().max(500).optional(),
  }),
)
class WidgetBookDto {
  publicKey!: string;
  serviceId!: string;
  clientName!: string;
  phone!: string;
  startsAt!: string;
  note?: string;
}

/** Buckets widget traffic per publishable key, not just per source IP. */
function widgetKeySubject(req: Request): string | undefined {
  const fromHeader = req.header('x-beauty-public-key');
  const fromParam = (req.params as { publicKey?: string } | undefined)?.publicKey;
  return fromHeader ?? fromParam;
}

@Controller('widget')
@UseGuards(RateLimitGuard)
export class WidgetController {
  constructor(private readonly widget: WidgetService) {}

  @Public()
  @Get('services')
  @RateLimit({ key: 'widget-key', limit: 60, windowSec: 60, subject: widgetKeySubject })
  services(@Headers('x-beauty-public-key') publicKey: string, @Headers('origin') origin?: string) {
    return this.widget.resolve(publicKey, origin);
  }

  @Public()
  @Post('book')
  @RateLimit({ key: 'widget-book', limit: 10, windowSec: 60, subject: widgetKeySubject })
  book(@Body() body: WidgetBookDto, @Headers('origin') origin?: string) {
    return this.widget.book({ ...body, origin });
  }

  @Public()
  @Get(':publicKey')
  @RateLimit({ key: 'widget-key', limit: 60, windowSec: 60, subject: widgetKeySubject })
  get(@Param('publicKey') publicKey: string, @Headers('origin') origin?: string) {
    return this.widget.resolve(publicKey, origin);
  }
}
