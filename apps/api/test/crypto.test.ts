import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PiiCryptoService } from '../src/common/crypto/pii-crypto.service';
import type { Env } from '@beauty/config';

function service(key = randomBytes(32).toString('base64')) {
  return new PiiCryptoService({ PII_ENCRYPTION_KEY: key } as Env);
}

describe('PiiCryptoService', () => {
  it('round-trips a phone number', () => {
    const svc = service();
    const encrypted = svc.encrypt('+79991234567');
    expect(encrypted).not.toContain('79991234567');
    expect(svc.decrypt(encrypted)).toBe('+79991234567');
  });

  it('produces different ciphertext for the same input', () => {
    const svc = service();
    expect(svc.encrypt('+79991234567')).not.toBe(svc.encrypt('+79991234567'));
  });

  it('refuses tampered ciphertext', () => {
    const svc = service();
    const encrypted = svc.encrypt('+79991234567');
    const parts = encrypted.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => svc.decrypt(parts.join('.'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const encrypted = service().encrypt('+79991234567');
    expect(() => service().decrypt(encrypted)).toThrow();
  });

  it('rejects a malformed envelope', () => {
    expect(() => service().decrypt('not-an-envelope')).toThrow(/bad_pii_envelope/);
  });
});
