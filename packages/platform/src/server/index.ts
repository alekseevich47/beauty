import { createHmac, timingSafeEqual } from 'node:crypto';

export type PlatformUser = {
  platformUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  photoUrl?: string;
};

export type InitDataValidationResult =
  { ok: true; user: PlatformUser; authDate: Date } | { ok: false; reason: string };

function parseQuery(initData: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of initData.split('&')) {
    const [k, ...rest] = part.split('=');
    if (!k) continue;
    map.set(decodeURIComponent(k), decodeURIComponent(rest.join('=')));
  }
  return map;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Telegram WebApp initData HMAC validation.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number,
): InitDataValidationResult {
  const params = parseQuery(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };

  const pairs = [...params.entries()]
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(pairs).digest('hex');

  if (!safeEqualHex(computed, hash)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) return { ok: false, reason: 'missing_auth_date' };
  const authDate = new Date(Number(authDateRaw) * 1000);
  if (Number.isNaN(authDate.getTime())) return { ok: false, reason: 'bad_auth_date' };
  const ageSec = (Date.now() - authDate.getTime()) / 1000;
  if (ageSec > maxAgeSec || ageSec < -60) {
    return { ok: false, reason: 'expired' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'missing_user' };
  let parsed: {
    id: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
    photo_url?: string;
  };
  try {
    parsed = JSON.parse(userRaw) as typeof parsed;
  } catch {
    return { ok: false, reason: 'bad_user_json' };
  }

  return {
    ok: true,
    authDate,
    user: {
      platformUserId: String(parsed.id),
      username: parsed.username,
      firstName: parsed.first_name,
      lastName: parsed.last_name,
      languageCode: parsed.language_code,
      photoUrl: parsed.photo_url,
    },
  };
}

/**
 * MAX Mini Apps initData-style HMAC validation.
 */
export function validateMaxInitData(
  initData: string,
  botToken: string,
  maxAgeSec: number,
): InitDataValidationResult {
  const params = parseQuery(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };

  const pairs = [...params.entries()]
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'MaxWebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(pairs).digest('hex');

  if (!safeEqualHex(computed, hash)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) return { ok: false, reason: 'missing_auth_date' };
  const authDate = new Date(Number(authDateRaw) * 1000);
  const ageSec = (Date.now() - authDate.getTime()) / 1000;
  if (ageSec > maxAgeSec || ageSec < -60) {
    return { ok: false, reason: 'expired' };
  }

  const userRaw = params.get('user');
  if (!userRaw) return { ok: false, reason: 'missing_user' };
  let parsed: { id: number | string; username?: string; first_name?: string };
  try {
    parsed = JSON.parse(userRaw) as typeof parsed;
  } catch {
    return { ok: false, reason: 'bad_user_json' };
  }

  return {
    ok: true,
    authDate,
    user: {
      platformUserId: String(parsed.id),
      username: parsed.username,
      firstName: parsed.first_name,
    },
  };
}

export { initDataReplayKey } from './replay';
