import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Env } from '@beauty/config';
import { APP_ENV } from '../tokens';

/**
 * AES-256-GCM envelope for personal data stored at rest (phone numbers).
 * Format: v1.<iv>.<tag>.<ciphertext>, all base64url.
 */
@Injectable()
export class PiiCryptoService {
  private readonly key: Buffer;

  constructor(@Inject(APP_ENV) env: Env) {
    this.key = Buffer.from(env.PII_ENCRYPTION_KEY, 'base64');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      data.toString('base64url'),
    ].join('.');
  }

  decrypt(stored: string): string {
    const [version, ivB64, tagB64, dataB64] = stored.split('.');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('bad_pii_envelope');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
