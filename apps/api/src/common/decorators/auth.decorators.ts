import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionCode, FeatureCode, UserRole } from '@beauty/contracts';

export const IS_PUBLIC = 'beauty:is_public';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'beauty:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'beauty:permissions';
export const RequirePermission = (...permissions: PermissionCode[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const FEATURE_KEY = 'beauty:feature';
export const RequireFeature = (feature: FeatureCode) => SetMetadata(FEATURE_KEY, feature);

export type AuthUser = {
  id: string;
  role: UserRole;
  masterId?: string;
};

export type StaffRoleName = 'admin' | 'support';

export type StaffAuth = {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRoleName[];
  permissions: PermissionCode[];
  sessionId: string;
};

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
  return req.user!;
});

export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): StaffAuth => {
  const req = ctx.switchToHttp().getRequest<{ staff?: StaffAuth }>();
  return req.staff!;
});
