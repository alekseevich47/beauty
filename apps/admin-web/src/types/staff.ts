import type { FeatureCode, PermissionCode, TariffCode } from '@beauty/contracts';

export type StaffRoleName = 'admin' | 'support';

export type StaffUser = {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRoleName[];
  permissions: PermissionCode[];
};

export type LoginChallenge = {
  challengeId: string;
  expiresAt: string;
};

export type SessionResponse = {
  user: StaffUser;
};

export type AccountKind = 'client' | 'master';

export type AccountSummary = {
  id: string;
  kind: AccountKind;
  displayName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  tariffCode: TariffCode | null;
  createdAt: string;
  status: 'active' | 'suspended' | 'deleted';
};

export type ChatThread = {
  id: string;
  masterId: string;
  masterName: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  author: 'staff' | 'master' | 'system';
  authorName: string;
  body: string;
  createdAt: string;
};

export type MetricPoint = {
  t: string;
  cpu: number;
  memory: number;
  rps: number;
  p95ms: number;
};

export type FeatureFlagRow = {
  code: FeatureCode;
  label: string;
  tariffs: Record<TariffCode, boolean>;
};

export type OpsJobKind = 'backup' | 'restart_api' | 'restart_db' | 'rebuild';

export type OpsJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dry_run';

export type OpsJob = {
  id: string;
  kind: OpsJobKind;
  dryRun: boolean;
  status: OpsJobStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

export type StaffMember = {
  id: string;
  email: string;
  displayName: string;
  roles: StaffRoleName[];
  totpEnabled: boolean;
  lastLoginAt: string | null;
  active: boolean;
};

export type AuditEntry = {
  id: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  meta: Record<string, string | number | boolean | null>;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};
