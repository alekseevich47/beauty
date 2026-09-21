import type { PermissionCode } from '@beauty/contracts';

import type { StaffUser } from '@/types/staff';

export function hasPermission(user: StaffUser | null | undefined, code: PermissionCode): boolean {
  if (!user) return false;
  return user.permissions.includes(code);
}

export function hasAnyPermission(
  user: StaffUser | null | undefined,
  codes: readonly PermissionCode[],
): boolean {
  if (!user) return false;
  return codes.some((c) => user.permissions.includes(c));
}

/** Nav visibility is UX-only; server still enforces permissions. */
export const NAV_ITEMS = [
  {
    to: '/chat',
    label: 'Чат',
    permissions: ['chat.read'] as const satisfies readonly PermissionCode[],
  },
  {
    to: '/accounts',
    label: 'Аккаунты',
    permissions: ['accounts.read'] as const satisfies readonly PermissionCode[],
  },
  {
    to: '/monitoring',
    label: 'Мониторинг',
    permissions: ['ops.metrics'] as const satisfies readonly PermissionCode[],
  },
  {
    to: '/features',
    label: 'Фичи / тарифы',
    permissions: ['features.toggle', 'tariffs.manage'] as const satisfies readonly PermissionCode[],
  },
  {
    to: '/ops',
    label: 'Операции',
    permissions: ['ops.restart', 'ops.backup'] as const satisfies readonly PermissionCode[],
  },
  {
    to: '/staff',
    label: 'Staff',
    permissions: ['staff.manage'] as const satisfies readonly PermissionCode[],
  },
  {
    to: '/audit',
    label: 'Аудит',
    permissions: ['audit.read'] as const satisfies readonly PermissionCode[],
  },
] as const;
