import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { initDataReplayKey, validateMaxInitData, validateTelegramInitData } from './server/index';

const TOKEN = '123456:ABC-DEF';

function sign(secretPrefix: string, botToken: string, pairs: string): string {
  const secretKey = createHmac('sha256', secretPrefix).update(botToken).digest();
  return createHmac('sha256', secretKey).update(pairs).digest('hex');
}

function buildInitData(opts: {
  secretPrefix: string;
  botToken: string;
  authDate: number;
  user: object;
}): string {
  const userStr = JSON.stringify(opts.user);
  const pairs = [`auth_date=${opts.authDate}`, `user=${userStr}`].join('\n');
  const hash = sign(opts.secretPrefix, opts.botToken, pairs);
  return `auth_date=${opts.authDate}&user=${encodeURIComponent(userStr)}&hash=${hash}`;
}

const now = () => Math.floor(Date.now() / 1000);

describe('validateTelegramInitData', () => {
  it('rejects a signature made with a different bot token', () => {
    const initData = buildInitData({
      secretPrefix: 'WebAppData',
      botToken: 'attacker-token',
      authDate: now(),
      user: { id: 1 },
    });
    expect(validateTelegramInitData(initData, TOKEN, 86400).ok).toBe(false);
  });

  it('rejects stale initData outside the freshness window', () => {
    const initData = buildInitData({
      secretPrefix: 'WebAppData',
      botToken: TOKEN,
      authDate: now() - 7200,
      user: { id: 1 },
    });
    const result = validateTelegramInitData(initData, TOKEN, 3600);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('rejects initData dated far in the future', () => {
    const initData = buildInitData({
      secretPrefix: 'WebAppData',
      botToken: TOKEN,
      authDate: now() + 3600,
      user: { id: 1 },
    });
    expect(validateTelegramInitData(initData, TOKEN, 86400).ok).toBe(false);
  });

  it('rejects initData with no hash', () => {
    const result = validateTelegramInitData('auth_date=1&user=%7B%7D', TOKEN, 86400);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_hash');
  });

  it('rejects a MAX-signed payload on the Telegram path', () => {
    // Cross-platform token reuse must not authenticate
    const initData = buildInitData({
      secretPrefix: 'MaxWebAppData',
      botToken: TOKEN,
      authDate: now(),
      user: { id: 1 },
    });
    expect(validateTelegramInitData(initData, TOKEN, 86400).ok).toBe(false);
  });
});

describe('validateMaxInitData', () => {
  it('accepts a correctly signed MAX payload', () => {
    const initData = buildInitData({
      secretPrefix: 'MaxWebAppData',
      botToken: TOKEN,
      authDate: now(),
      user: { id: 77, first_name: 'Vera' },
    });
    const result = validateMaxInitData(initData, TOKEN, 86400);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.platformUserId).toBe('77');
  });

  it('rejects a Telegram-signed payload on the MAX path', () => {
    const initData = buildInitData({
      secretPrefix: 'WebAppData',
      botToken: TOKEN,
      authDate: now(),
      user: { id: 77 },
    });
    expect(validateMaxInitData(initData, TOKEN, 86400).ok).toBe(false);
  });
});

describe('initDataReplayKey', () => {
  it('namespaces per platform so hashes cannot collide across messengers', () => {
    expect(initDataReplayKey('telegram', 'abc')).toBe('initdata:replay:telegram:abc');
    expect(initDataReplayKey('max', 'abc')).not.toBe(initDataReplayKey('telegram', 'abc'));
  });
});
