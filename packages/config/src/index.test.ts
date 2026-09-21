import { describe, expect, it, afterEach } from 'vitest';
import { loadEnv, resetEnvCache, parseCorsOrigins } from './index.js';

const validBase = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/beauty',
  REDIS_CACHE_URL: 'redis://localhost:6379/0',
  REDIS_QUEUE_URL: 'redis://localhost:6380/0',
  JWT_ACCESS_PRIVATE_KEY: 'test-private-key',
  JWT_ACCESS_PUBLIC_KEY: 'test-public-key',
  STAFF_JWT_SECRET: 'a'.repeat(32),
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  PII_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
};

describe('loadEnv', () => {
  afterEach(() => resetEnvCache());

  it('loads valid env', () => {
    const env = loadEnv(validBase as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.API_PORT).toBe(3000);
  });

  it('fails on missing required fields', () => {
    expect(() => loadEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects a TOTP key that is not 32 bytes', () => {
    expect(() =>
      loadEnv({
        ...validBase,
        TOTP_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
      } as NodeJS.ProcessEnv),
    ).toThrow(/TOTP_ENCRYPTION_KEY/);
  });
});

describe('parseCorsOrigins', () => {
  it('splits and trims', () => {
    expect(parseCorsOrigins('https://a.ru, https://b.ru')).toEqual([
      'https://a.ru',
      'https://b.ru',
    ]);
  });
});
