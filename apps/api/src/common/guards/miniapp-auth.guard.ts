import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { SignJWT, importPKCS8, importSPKI, jwtVerify, type KeyLike } from 'jose';
import { randomUUID, randomBytes } from 'node:crypto';
import type { Env } from '@beauty/config';
import type { Db } from '@beauty/db';
import { refreshTokens, users, masters } from '@beauty/db';
import type { UserRole } from '@beauty/contracts';
import { APP_ENV, DB } from '../tokens';
import { IS_PUBLIC, ROLES_KEY, type AuthUser } from '../decorators/auth.decorators';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

@Injectable()
export class MiniAppJwtService {
  private privateKey?: KeyLike;
  private publicKey?: KeyLike;

  constructor(@Inject(APP_ENV) private readonly env: Env) {}

  private async keys(): Promise<{ privateKey: KeyLike; publicKey: KeyLike }> {
    if (!this.privateKey || !this.publicKey) {
      this.privateKey = await importPKCS8(this.env.JWT_ACCESS_PRIVATE_KEY, 'EdDSA');
      this.publicKey = await importSPKI(this.env.JWT_ACCESS_PUBLIC_KEY, 'EdDSA');
    }
    return { privateKey: this.privateKey, publicKey: this.publicKey };
  }

  async signAccess(payload: { sub: string; role: UserRole; masterId?: string }): Promise<string> {
    const { privateKey } = await this.keys();
    return new SignJWT({
      role: payload.role,
      masterId: payload.masterId,
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${this.env.JWT_ACCESS_TTL_SEC}s`)
      .setAudience('beauty-miniapp')
      .setIssuer('beauty-api')
      .sign(privateKey);
  }

  async verifyAccess(token: string): Promise<{
    sub: string;
    role: UserRole;
    masterId?: string;
  }> {
    const { publicKey } = await this.keys();
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['EdDSA'],
      audience: 'beauty-miniapp',
      issuer: 'beauty-api',
    });
    const role = payload.role as UserRole;
    if (role !== 'client' && role !== 'master') {
      throw new UnauthorizedException({
        error: { code: 'INVALID_ROLE', message: 'Invalid token role' },
      });
    }
    return {
      sub: String(payload.sub),
      role,
      masterId: payload.masterId ? String(payload.masterId) : undefined,
    };
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueRefresh(
    db: Db,
    userId: string,
    familyId?: string,
  ): Promise<{ token: string; familyId: string; id: string }> {
    const token = randomBytes(48).toString('base64url');
    const family = familyId ?? randomUUID();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + this.env.JWT_REFRESH_TTL_SEC * 1000);
    await db.insert(refreshTokens).values({
      id,
      userId,
      familyId: family,
      tokenHash: this.hashRefresh(token),
      expiresAt,
    });
    return { token, familyId: family, id };
  }

  async rotateRefresh(
    db: Db,
    presented: string,
  ): Promise<{ userId: string; familyId: string; newToken: string }> {
    const hash = this.hashRefresh(presented);
    const [row] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hash))
      .limit(1);

    if (!row) {
      throw new UnauthorizedException({
        error: { code: 'INVALID_REFRESH', message: 'Refresh token unknown' },
      });
    }

    // Reuse detection: already revoked/replaced → revoke entire family
    if (row.revokedAt || row.replacedById) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
      throw new UnauthorizedException({
        error: {
          code: 'REFRESH_REUSE',
          message: 'Refresh token reuse detected; family revoked',
        },
      });
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        error: { code: 'REFRESH_EXPIRED', message: 'Refresh token expired' },
      });
    }

    const next = await this.issueRefresh(db, row.userId, row.familyId);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), replacedById: next.id })
      .where(eq(refreshTokens.id, row.id));

    return {
      userId: row.userId,
      familyId: row.familyId,
      newToken: next.token,
    };
  }
}

@Injectable()
export class MiniAppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: MiniAppJwtService,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      });
    }
    const token = header.slice(7);
    try {
      const payload = await this.jwt.verifyAccess(token);
      const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (roles?.length && !roles.includes(payload.role)) {
        throw new UnauthorizedException({
          error: { code: 'FORBIDDEN_ROLE', message: 'Role not allowed' },
        });
      }

      let masterId = payload.masterId;
      if (payload.role === 'master' && !masterId) {
        const [m] = await this.db
          .select({ id: masters.id })
          .from(masters)
          .where(eq(masters.userId, payload.sub))
          .limit(1);
        masterId = m?.id;
      }

      const [u] = await this.db
        .select({ id: users.id, isBlocked: users.isBlocked, role: users.role })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1);
      if (!u || u.isBlocked) {
        throw new UnauthorizedException({
          error: { code: 'USER_BLOCKED', message: 'User blocked or missing' },
        });
      }

      req.user = { id: u.id, role: u.role, masterId };
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({
        error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
      });
    }
  }
}
