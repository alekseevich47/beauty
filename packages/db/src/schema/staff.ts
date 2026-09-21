import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { masters, timestamps, users } from './miniapp';

export const staffUsers = pgTable(
  'staff_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: varchar('display_name', { length: 160 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    totpEnabled: boolean('totp_enabled').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex('staff_users_email_uidx').on(t.email)],
);

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    ...timestamps,
  },
  (t) => [uniqueIndex('roles_code_uidx').on(t.code)],
);

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    ...timestamps,
  },
  (t) => [uniqueIndex('permissions_code_uidx').on(t.code)],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('role_permissions_uidx').on(t.roleId, t.permissionId)],
);

export const staffUserRoles = pgTable(
  'staff_user_roles',
  {
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('staff_user_roles_uidx').on(t.staffUserId, t.roleId)],
);

export const staffSessions = pgTable(
  'staff_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 128 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: varchar('ip', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('staff_sessions_hash_uidx').on(t.tokenHash),
    index('staff_sessions_user_idx').on(t.staffUserId),
  ],
);

export const staffTotpSecrets = pgTable('staff_totp_secrets', {
  staffUserId: uuid('staff_user_id')
    .primaryKey()
    .references(() => staffUsers.id, { onDelete: 'cascade' }),
  secretEncrypted: text('secret_encrypted').notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staffLoginChallenges = pgTable(
  'staff_login_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffUserId: uuid('staff_user_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_login_challenges_user_idx').on(t.staffUserId)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorStaffId: uuid('actor_staff_id').references(() => staffUsers.id),
    action: varchar('action', { length: 96 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_actor_idx').on(t.actorStaffId, t.createdAt),
    index('audit_logs_action_idx').on(t.action, t.createdAt),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId, t.createdAt),
  ],
);

export const opsJobs = pgTable(
  'ops_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('queued'),
    requestedBy: uuid('requested_by').references(() => staffUsers.id),
    dryRun: boolean('dry_run').notNull().default(false),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
    result: jsonb('result').$type<Record<string, unknown>>(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ops_jobs_status_idx').on(t.status, t.createdAt)],
);

export const supportThreads = pgTable(
  'support_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    masterId: uuid('master_id')
      .notNull()
      .references(() => masters.id),
    assignedStaffId: uuid('assigned_staff_id').references(() => staffUsers.id),
    status: varchar('status', { length: 32 }).notNull().default('open'),
    subject: varchar('subject', { length: 200 }),
    ...timestamps,
  },
  (t) => [
    index('support_threads_master_idx').on(t.masterId),
    index('support_threads_staff_idx').on(t.assignedStaffId, t.status),
  ],
);

export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => supportThreads.id, { onDelete: 'cascade' }),
    senderStaffId: uuid('sender_staff_id').references(() => staffUsers.id),
    senderUserId: uuid('sender_user_id').references(() => users.id),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('support_messages_thread_idx').on(t.threadId, t.createdAt)],
);
