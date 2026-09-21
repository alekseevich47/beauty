import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { SignJWT, jwtVerify } from 'jose';
import type { Request, Response } from 'express';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import {
  staffUsers,
  staffSessions,
  staffTotpSecrets,
  staffLoginChallenges,
  staffUserRoles,
  rolePermissions,
  permissions,
  roles as rolesTable,
} from '@beauty/db';
import type { PermissionCode } from '@beauty/contracts';
import type Redis from 'ioredis';
import { APP_ENV, DB, REDIS_CACHE } from '../tokens';
import {
  IS_PUBLIC,
  PERMISSIONS_KEY,
  type StaffAuth,
  type StaffRoleName,
} from '../decorators/auth.decorators';

const encoder = new TextEncoder();

/**
 * AES-256-GCM envelope for TOTP secrets: v1.<iv>.<tag>.<ciphertext>, all base64url.
 * The key is dedicated (TOTP_ENCRYPTION_KEY) and never shared with session signing.
 */
function encryptSecret(plain: string, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function decryptSecret(stored: string, keyB64: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('bad_secret_envelope');
  }
  const key = Buffer.from(keyB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

@Injectable()
export class StaffAuthService {
  constructor(
    @Inject(APP_ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    @Inject(REDIS_CACHE) private readonly redis: Redis,
  ) {}

  private lockKey(scope: string, id: string): string {
    return `staff:lock:${scope}:${id}`;
  }

  private async assertNotLocked(scope: string, id: string): Promise<void> {
    const attempts = Number((await this.redis.get(this.lockKey(scope, id))) ?? 0);
    if (attempts >= this.env.STAFF_TOTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException({
        error: {
          code: 'LOCKED_OUT',
          message: 'Too many failed attempts; try again later',
        },
      });
    }
  }

  private async registerFailure(scope: string, id: string): Promise<void> {
    const key = this.lockKey(scope, id);
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, this.env.STAFF_LOCKOUT_SEC);
    }
  }

  private async clearFailures(scope: string, id: string): Promise<void> {
    await this.redis.del(this.lockKey(scope, id));
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async resolveRoles(staffUserId: string): Promise<StaffRoleName[]> {
    const rows = await this.db
      .select({ code: rolesTable.code })
      .from(staffUserRoles)
      .innerJoin(rolesTable, eq(rolesTable.id, staffUserRoles.roleId))
      .where(eq(staffUserRoles.staffUserId, staffUserId));
    return rows
      .map((r) => r.code)
      .filter((c): c is StaffRoleName => c === 'admin' || c === 'support');
  }

  async resolvePermissions(staffUserId: string): Promise<PermissionCode[]> {
    const rows = await this.db
      .select({ code: permissions.code })
      .from(staffUserRoles)
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, staffUserRoles.roleId))
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(eq(staffUserRoles.staffUserId, staffUserId));
    return [...new Set(rows.map((r) => r.code as PermissionCode))];
  }

  async loginStep1(
    email: string,
    password: string,
  ): Promise<{ challengeId: string; expiresAt: string }> {
    const normalized = email.toLowerCase();
    await this.assertNotLocked('password', normalized);

    const [staff] = await this.db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.email, normalized))
      .limit(1);

    // Constant-ish failure path
    const ok = staff && staff.isActive && (await this.verifyPassword(staff.passwordHash, password));

    if (!ok || !staff) {
      await this.registerFailure('password', normalized);
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
    }

    if (!staff.totpEnabled) {
      throw new UnauthorizedException({
        error: { code: 'TOTP_REQUIRED_SETUP', message: 'TOTP must be enabled' },
      });
    }

    await this.clearFailures('password', normalized);

    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.db.insert(staffLoginChallenges).values({
      id: challengeId,
      staffUserId: staff.id,
      expiresAt,
    });
    return { challengeId, expiresAt: expiresAt.toISOString() };
  }

  async loginStep2(
    challengeId: string,
    code: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ token: string; staff: StaffAuth }> {
    const [challenge] = await this.db
      .select()
      .from(staffLoginChallenges)
      .where(eq(staffLoginChallenges.id, challengeId))
      .limit(1);

    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_CHALLENGE', message: 'Login challenge invalid' },
      });
    }

    const [secretRow] = await this.db
      .select()
      .from(staffTotpSecrets)
      .where(eq(staffTotpSecrets.staffUserId, challenge.staffUserId))
      .limit(1);

    if (!secretRow?.verifiedAt) {
      throw new UnauthorizedException({
        error: { code: 'TOTP_NOT_CONFIGURED', message: 'TOTP not configured' },
      });
    }

    await this.assertNotLocked('totp', challenge.staffUserId);

    const secret = decryptSecret(secretRow.secretEncrypted, this.env.TOTP_ENCRYPTION_KEY);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      await this.registerFailure('totp', challenge.staffUserId);
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOTP', message: 'Invalid TOTP code' },
      });
    }

    // Single-use: burn the code for its whole time step so a captured code cannot be replayed
    const usedKey = `staff:totp:used:${challenge.staffUserId}:${code}`;
    if ((await this.redis.set(usedKey, '1', 'EX', 90, 'NX')) !== 'OK') {
      throw new UnauthorizedException({
        error: { code: 'TOTP_REPLAY', message: 'TOTP code already used' },
      });
    }

    await this.clearFailures('totp', challenge.staffUserId);

    await this.db
      .update(staffLoginChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(staffLoginChallenges.id, challengeId));

    const [staff] = await this.db
      .select()
      .from(staffUsers)
      .where(eq(staffUsers.id, challenge.staffUserId))
      .limit(1);
    if (!staff) {
      throw new UnauthorizedException({
        error: { code: 'STAFF_MISSING', message: 'Staff user missing' },
      });
    }

    const raw = randomBytes(32).toString('base64url');
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + this.env.STAFF_SESSION_TTL_SEC * 1000);

    await this.db.insert(staffSessions).values({
      id: sessionId,
      staffUserId: staff.id,
      tokenHash: this.hashToken(raw),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.db
      .update(staffUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(staffUsers.id, staff.id));

    const perms = await this.resolvePermissions(staff.id);
    const staffRoles = await this.resolveRoles(staff.id);
    const jwt = await new SignJWT({
      sid: sessionId,
      email: staff.email,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(staff.id)
      .setIssuedAt()
      .setExpirationTime(`${this.env.STAFF_SESSION_TTL_SEC}s`)
      .setAudience('beauty-staff')
      .setIssuer('beauty-api')
      .sign(encoder.encode(this.env.STAFF_JWT_SECRET));

    // Embed opaque session token in cookie value as jwt.opaque for revocation
    const cookieValue = `${jwt}.${raw}`;

    return {
      token: cookieValue,
      staff: {
        id: staff.id,
        email: staff.email,
        displayName: staff.displayName,
        roles: staffRoles,
        permissions: perms,
        sessionId,
      },
    };
  }

  async verifySession(cookieValue: string): Promise<StaffAuth> {
    const lastDot = cookieValue.lastIndexOf('.');
    if (lastDot < 0) {
      throw new UnauthorizedException({
        error: { code: 'NO_SESSION', message: 'Missing session' },
      });
    }
    // JWT has two dots; opaque is after the last segment of our composite
    // Format: <jwt>.<opaque> where jwt itself contains dots — split from end
    const parts = cookieValue.split('.');
    if (parts.length < 4) {
      throw new UnauthorizedException({
        error: { code: 'BAD_SESSION', message: 'Malformed session' },
      });
    }
    const opaque = parts[parts.length - 1]!;
    const jwt = parts.slice(0, -1).join('.');

    const { payload } = await jwtVerify(jwt, encoder.encode(this.env.STAFF_JWT_SECRET), {
      algorithms: ['HS256'],
      audience: 'beauty-staff',
      issuer: 'beauty-api',
    });

    const sessionId = String(payload.sid);
    const staffId = String(payload.sub);
    const [session] = await this.db
      .select()
      .from(staffSessions)
      .where(
        and(
          eq(staffSessions.id, sessionId),
          eq(staffSessions.tokenHash, this.hashToken(opaque)),
          isNull(staffSessions.revokedAt),
          gt(staffSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!session) {
      throw new UnauthorizedException({
        error: { code: 'SESSION_REVOKED', message: 'Session revoked or expired' },
      });
    }

    const [staff] = await this.db
      .select({
        email: staffUsers.email,
        displayName: staffUsers.displayName,
        isActive: staffUsers.isActive,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffId))
      .limit(1);

    if (!staff?.isActive) {
      throw new UnauthorizedException({
        error: { code: 'STAFF_INACTIVE', message: 'Staff inactive' },
      });
    }

    // Permissions and roles are always re-read per request, never trusted from the JWT
    const perms = await this.resolvePermissions(staffId);
    const staffRoles = await this.resolveRoles(staffId);

    return {
      id: staffId,
      email: staff.email,
      displayName: staff.displayName,
      roles: staffRoles,
      permissions: perms,
      sessionId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.db
      .update(staffSessions)
      .set({ revokedAt: new Date() })
      .where(eq(staffSessions.id, sessionId));
  }

  setSessionCookie(res: Response, token: string): void {
    const parts = [
      `${this.env.STAFF_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'HttpOnly',
      'SameSite=Strict',
      `Path=/`,
      `Max-Age=${this.env.STAFF_SESSION_TTL_SEC}`,
      `Domain=${this.env.STAFF_COOKIE_DOMAIN}`,
    ];
    if (this.env.STAFF_COOKIE_SECURE) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  clearSessionCookie(res: Response): void {
    const parts = [
      `${this.env.STAFF_COOKIE_NAME}=`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=0',
      `Domain=${this.env.STAFF_COOKIE_DOMAIN}`,
    ];
    if (this.env.STAFF_COOKIE_SECURE) parts.push('Secure');
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  /** Provision encrypted TOTP secret (admin bootstrap / enrollment). */
  async enrollTotp(staffUserId: string): Promise<{ secret: string; otpauth: string }> {
    const secret = authenticator.generateSecret();
    const [staff] = await this.db
      .select({ email: staffUsers.email })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffUserId))
      .limit(1);
    await this.db
      .insert(staffTotpSecrets)
      .values({
        staffUserId,
        secretEncrypted: encryptSecret(secret, this.env.TOTP_ENCRYPTION_KEY),
      })
      .onConflictDoUpdate({
        target: staffTotpSecrets.staffUserId,
        set: {
          secretEncrypted: encryptSecret(secret, this.env.TOTP_ENCRYPTION_KEY),
          verifiedAt: null,
        },
      });
    const otpauth = authenticator.keyuri(staff?.email ?? staffUserId, 'Beauty+', secret);
    return { secret, otpauth };
  }

  async verifyTotpEnrollment(staffUserId: string, code: string): Promise<void> {
    const [row] = await this.db
      .select()
      .from(staffTotpSecrets)
      .where(eq(staffTotpSecrets.staffUserId, staffUserId))
      .limit(1);
    if (!row) {
      throw new UnauthorizedException({
        error: { code: 'NO_TOTP', message: 'No TOTP secret' },
      });
    }
    const secret = decryptSecret(row.secretEncrypted, this.env.TOTP_ENCRYPTION_KEY);
    if (!authenticator.verify({ token: code, secret })) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOTP', message: 'Invalid TOTP code' },
      });
    }
    await this.db
      .update(staffTotpSecrets)
      .set({ verifiedAt: new Date() })
      .where(eq(staffTotpSecrets.staffUserId, staffUserId));
    await this.db
      .update(staffUsers)
      .set({ totpEnabled: true })
      .where(eq(staffUsers.id, staffUserId));
  }
}

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly staffAuth: StaffAuthService,
    @Inject(APP_ENV) private readonly env: Env,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { staff?: StaffAuth; cookies?: Record<string, string> }>();
    const cookie = this.readCookie(req, this.env.STAFF_COOKIE_NAME);

    if (!cookie) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Staff session required' },
      });
    }

    req.staff = await this.staffAuth.verifySession(cookie);
    return true;
  }

  private readCookie(req: Request & { cookies?: Record<string, string> }, name: string) {
    if (req.cookies?.[name]) return req.cookies[name];
    const header = req.headers.cookie;
    if (!header) return undefined;
    for (const part of header.split(';')) {
      const trimmed = part.trim();
      if (!trimmed.startsWith(`${name}=`)) continue;
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
    return undefined;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ staff?: StaffAuth }>();
    const perms = new Set(req.staff?.permissions ?? []);
    const ok = required.every((p) => perms.has(p));
    if (!ok) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'Missing permission' },
      });
    }
    return true;
  }
}
