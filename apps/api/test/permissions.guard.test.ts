import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PermissionsGuard } from '../src/common/guards/staff-auth.guard';
import { PERMISSIONS_KEY, type StaffAuth } from '../src/common/decorators/auth.decorators';

function contextWith(staff: StaffAuth | undefined, required?: string[]): ExecutionContext {
  const handler = () => undefined;
  if (required) Reflect.defineMetadata(PERMISSIONS_KEY, required, handler);
  return {
    getHandler: () => handler,
    getClass: () => class Dummy {},
    switchToHttp: () => ({ getRequest: () => ({ staff }) }),
  } as unknown as ExecutionContext;
}

const support: StaffAuth = {
  id: 's1',
  email: 'support@loomixx.ru',
  displayName: 'Support',
  roles: ['support'],
  permissions: ['chat.read', 'chat.write', 'accounts.read', 'accounts.write'],
  sessionId: 'sess1',
};

const admin: StaffAuth = {
  ...support,
  id: 'a1',
  email: 'admin@loomixx.ru',
  displayName: 'Admin',
  roles: ['admin'],
  permissions: [...support.permissions, 'ops.restart', 'ops.backup', 'ops.metrics'],
};

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('allows a route with no permission metadata', () => {
    expect(guard.canActivate(contextWith(support))).toBe(true);
  });

  it('allows support on chat routes', () => {
    expect(guard.canActivate(contextWith(support, ['chat.read']))).toBe(true);
  });

  it('denies support the dangerous ops routes', () => {
    // Support must never reach restart/backup even if the UI hides the menu
    expect(() => guard.canActivate(contextWith(support, ['ops.restart']))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(contextWith(support, ['ops.backup']))).toThrow(
      ForbiddenException,
    );
  });

  it('denies an unauthenticated request', () => {
    expect(() => guard.canActivate(contextWith(undefined, ['accounts.read']))).toThrow(
      ForbiddenException,
    );
  });

  it('requires every listed permission, not just one', () => {
    expect(() => guard.canActivate(contextWith(support, ['accounts.read', 'ops.metrics']))).toThrow(
      ForbiddenException,
    );
  });

  it('allows admin on ops routes', () => {
    expect(guard.canActivate(contextWith(admin, ['ops.restart']))).toBe(true);
  });
});
