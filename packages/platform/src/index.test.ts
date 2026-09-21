import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateTelegramInitData } from './server/index.js';

function buildTelegramInitData(botToken: string, user: object, authDate: number): string {
  const userStr = JSON.stringify(user);
  const params = new Map<string, string>([
    ['auth_date', String(authDate)],
    ['user', userStr],
  ]);
  const pairs = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(pairs).digest('hex');
  return `auth_date=${authDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
}

describe('validateTelegramInitData', () => {
  const token = '123456:ABC-DEF';

  it('accepts valid fresh initData', () => {
    const initData = buildTelegramInitData(
      token,
      { id: 42, first_name: 'Ada' },
      Math.floor(Date.now() / 1000),
    );
    const result = validateTelegramInitData(initData, token, 86400);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.platformUserId).toBe('42');
      expect(result.user.firstName).toBe('Ada');
    }
  });

  it('rejects tampered data', () => {
    const initData = buildTelegramInitData(token, { id: 42 }, Math.floor(Date.now() / 1000));
    const tampered = initData.replace('hash=', 'hash=00');
    const result = validateTelegramInitData(tampered, token, 86400);
    expect(result.ok).toBe(false);
  });
});
