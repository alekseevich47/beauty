import { Inject, Injectable, Logger } from '@nestjs/common';
import { SignJWT } from 'jose';
import type { Env } from '@beauty/config';
import { APP_ENV } from '../tokens';

const encoder = new TextEncoder();

/**
 * Centrifugo integration: issues short-lived connection/subscription tokens and
 * publishes server-side events. Channel names are always derived server-side so a
 * client can never ask for a channel it is not entitled to.
 */
@Injectable()
export class CentrifugoService {
  private readonly logger = new Logger(CentrifugoService.name);

  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  get enabled(): boolean {
    return Boolean(this.env.CENTRIFUGO_TOKEN_SECRET && this.env.CENTRIFUGO_API_URL);
  }

  static supportThreadChannel(threadId: string): string {
    return `support:thread:${threadId}`;
  }

  /** Connection token bound to a subject with an explicit channel allowlist. */
  async issueConnectionToken(
    subject: string,
    channels: string[],
    ttlSec = 600,
  ): Promise<string | null> {
    if (!this.env.CENTRIFUGO_TOKEN_SECRET) return null;
    return new SignJWT({ sub: subject, channels })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${ttlSec}s`)
      .sign(encoder.encode(this.env.CENTRIFUGO_TOKEN_SECRET));
  }

  async publish(channel: string, data: unknown): Promise<void> {
    if (!this.env.CENTRIFUGO_API_URL || !this.env.CENTRIFUGO_API_KEY) return;
    try {
      const res = await fetch(this.env.CENTRIFUGO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.env.CENTRIFUGO_API_KEY,
        },
        body: JSON.stringify({ method: 'publish', params: { channel, data } }),
      });
      if (!res.ok) {
        this.logger.warn(`Centrifugo publish failed: ${res.status}`);
      }
    } catch (err) {
      // Real-time delivery is best-effort; the message is already persisted
      this.logger.warn(`Centrifugo publish error: ${String(err)}`);
    }
  }
}
