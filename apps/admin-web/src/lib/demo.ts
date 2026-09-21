import type { PermissionCode } from '@beauty/contracts';

import type {
  AccountSummary,
  AuditEntry,
  ChatMessage,
  ChatThread,
  FeatureFlagRow,
  LoginChallenge,
  MetricPoint,
  OpsJob,
  OpsJobKind,
  SessionResponse,
  StaffMember,
  StaffUser,
} from '@/types/staff';

const ADMIN_PERMS: PermissionCode[] = [
  'chat.read',
  'chat.write',
  'accounts.read',
  'accounts.write',
  'features.toggle',
  'tariffs.manage',
  'ops.metrics',
  'ops.restart',
  'ops.backup',
  'staff.manage',
  'audit.read',
];

const SUPPORT_PERMS: PermissionCode[] = [
  'chat.read',
  'chat.write',
  'accounts.read',
  'accounts.write',
];

export const DEMO_ADMIN: StaffUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@beauty.local',
  displayName: 'Demo Admin',
  roles: ['admin'],
  permissions: ADMIN_PERMS,
};

export const DEMO_SUPPORT: StaffUser = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'support@beauty.local',
  displayName: 'Demo Support',
  roles: ['support'],
  permissions: SUPPORT_PERMS,
};

const challengeStore = new Map<string, { email: string; expiresAt: number }>();
const opsJobs = new Map<string, OpsJob>();

function uuid(): string {
  return crypto.randomUUID();
}

function delay(ms = 280): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

export async function demoLogin(email: string, _password: string): Promise<LoginChallenge> {
  await delay();
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) {
    throw new Error('Некорректный email');
  }
  const challengeId = uuid();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  challengeStore.set(challengeId, { email: normalized, expiresAt: Date.now() + 5 * 60_000 });
  return { challengeId, expiresAt };
}

export async function demoVerifyTotp(challengeId: string, code: string): Promise<SessionResponse> {
  await delay();
  const entry = challengeStore.get(challengeId);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new Error('Сессия входа истекла. Войдите снова.');
  }
  if (!/^\d{6}$/.test(code)) {
    throw new Error('Код TOTP должен содержать 6 цифр');
  }
  // Demo accepts any 6-digit code; 000000 → support, else admin
  const user = code === '000000' ? DEMO_SUPPORT : DEMO_ADMIN;
  challengeStore.delete(challengeId);
  sessionStorage.setItem('beauty_demo_session', JSON.stringify(user));
  return { user };
}

export async function demoSession(): Promise<SessionResponse | null> {
  await delay(80);
  const raw = sessionStorage.getItem('beauty_demo_session');
  if (!raw) return null;
  try {
    return { user: JSON.parse(raw) as StaffUser };
  } catch {
    return null;
  }
}

export async function demoLogout(): Promise<void> {
  await delay(80);
  sessionStorage.removeItem('beauty_demo_session');
}

export async function demoAccounts(q = ''): Promise<AccountSummary[]> {
  await delay();
  const rows: AccountSummary[] = [
    {
      id: 'a1',
      kind: 'master',
      displayName: 'Анна Ковалёва',
      email: 'anna@example.com',
      phone: '+7 900 111-22-33',
      city: 'Москва',
      tariffCode: 'premium',
      createdAt: '2025-11-02T10:00:00Z',
      status: 'active',
    },
    {
      id: 'a2',
      kind: 'master',
      displayName: 'Игорь Смирнов',
      email: 'igor@example.com',
      phone: '+7 900 222-33-44',
      city: 'Санкт-Петербург',
      tariffCode: 'standard',
      createdAt: '2025-12-14T08:30:00Z',
      status: 'active',
    },
    {
      id: 'a3',
      kind: 'client',
      displayName: 'Мария Петрова',
      email: null,
      phone: '+7 926 555-01-02',
      city: 'Казань',
      tariffCode: null,
      createdAt: '2026-01-20T15:12:00Z',
      status: 'active',
    },
    {
      id: 'a4',
      kind: 'master',
      displayName: 'Ultra Studio',
      email: 'ultra@example.com',
      phone: '+7 900 999-00-11',
      city: 'Екатеринбург',
      tariffCode: 'ultra',
      createdAt: '2025-08-01T12:00:00Z',
      status: 'suspended',
    },
  ];
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (r) =>
      r.displayName.toLowerCase().includes(needle) ||
      r.email?.toLowerCase().includes(needle) ||
      r.phone?.includes(needle),
  );
}

export async function demoThreads(): Promise<ChatThread[]> {
  await delay();
  return [
    {
      id: 't1',
      masterId: 'a1',
      masterName: 'Анна Ковалёва',
      lastMessage: 'Не приходит уведомление о записи',
      unread: 2,
      updatedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    },
    {
      id: 't2',
      masterId: 'a2',
      masterName: 'Игорь Смирнов',
      lastMessage: 'Как сменить тариф на Premium?',
      unread: 0,
      updatedAt: new Date(Date.now() - 55 * 60_000).toISOString(),
    },
  ];
}

export async function demoMessages(threadId: string): Promise<ChatMessage[]> {
  await delay();
  if (threadId === 't2') {
    return [
      {
        id: 'm3',
        threadId,
        author: 'master',
        authorName: 'Игорь Смирнов',
        body: 'Как сменить тариф на Premium?',
        createdAt: new Date(Date.now() - 55 * 60_000).toISOString(),
      },
      {
        id: 'm4',
        threadId,
        author: 'staff',
        authorName: 'Support',
        body: 'В кабинете: Ещё → Подписка → Premium. Оплата через ЮKassa.',
        createdAt: new Date(Date.now() - 50 * 60_000).toISOString(),
      },
    ];
  }
  return [
    {
      id: 'm1',
      threadId,
      author: 'master',
      authorName: 'Анна Ковалёва',
      body: 'Не приходит уведомление о записи клиенту.',
      createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    },
    {
      id: 'm2',
      threadId,
      author: 'staff',
      authorName: 'Support',
      body: 'Проверяю доставку в Telegram/MAX. Уточните platformUserId клиента.',
      createdAt: new Date(Date.now() - 8 * 60_000).toISOString(),
    },
  ];
}

export async function demoSendMessage(
  threadId: string,
  body: string,
  authorName: string,
): Promise<ChatMessage> {
  await delay();
  return {
    id: uuid(),
    threadId,
    author: 'staff',
    authorName,
    body,
    createdAt: new Date().toISOString(),
  };
}

export async function demoMetrics(): Promise<MetricPoint[]> {
  await delay();
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => {
    const t = new Date(now - (23 - i) * 3_600_000).toISOString();
    return {
      t,
      cpu: 22 + Math.round(Math.sin(i / 3) * 12 + Math.random() * 8),
      memory: 48 + Math.round(Math.cos(i / 4) * 10 + Math.random() * 6),
      rps: 80 + Math.round(Math.sin(i / 2) * 40 + Math.random() * 20),
      p95ms: 90 + Math.round(Math.cos(i / 5) * 30 + Math.random() * 25),
    };
  });
}

export async function demoFeatures(): Promise<FeatureFlagRow[]> {
  await delay();
  return [
    {
      code: 'blacklist',
      label: 'Чёрный список',
      tariffs: { standard: false, premium: true, ultra: true },
    },
    {
      code: 'waiting_list',
      label: 'Лист ожидания',
      tariffs: { standard: false, premium: true, ultra: true },
    },
    {
      code: 'ai_client_analysis',
      label: 'AI-анализ клиентов',
      tariffs: { standard: false, premium: true, ultra: true },
    },
    {
      code: 'cabinet_branding',
      label: 'Брендинг кабинета',
      tariffs: { standard: false, premium: true, ultra: true },
    },
    {
      code: 'custom_ultra',
      label: 'Кастом Ultra',
      tariffs: { standard: false, premium: false, ultra: true },
    },
    {
      code: 'broadcast_monthly',
      label: 'Рассылки (мес.)',
      tariffs: { standard: true, premium: true, ultra: true },
    },
    {
      code: 'master_of_week',
      label: 'Мастер недели',
      tariffs: { standard: true, premium: true, ultra: true },
    },
  ];
}

export async function demoCreateOpsJob(kind: OpsJobKind, dryRun: boolean): Promise<OpsJob> {
  await delay(200);
  const id = uuid();
  const now = new Date().toISOString();
  const job: OpsJob = {
    id,
    kind,
    dryRun,
    status: dryRun ? 'dry_run' : 'queued',
    message: dryRun
      ? `Dry-run: ${kind} — проверка прав, блокировок и целевого узла`
      : `Задача ${kind} поставлена в очередь`,
    createdAt: now,
    updatedAt: now,
    finishedAt: dryRun ? now : null,
  };
  opsJobs.set(id, job);

  if (!dryRun) {
    void (async () => {
      await delay(900);
      const running = opsJobs.get(id);
      if (!running) return;
      running.status = 'running';
      running.message = `Выполняется ${kind}…`;
      running.updatedAt = new Date().toISOString();
      await delay(1600);
      const done = opsJobs.get(id);
      if (!done) return;
      done.status = 'succeeded';
      done.message = `${kind} завершён успешно`;
      done.updatedAt = new Date().toISOString();
      done.finishedAt = done.updatedAt;
    })();
  }

  return structuredClone(job);
}

export async function demoGetOpsJob(id: string): Promise<OpsJob | null> {
  await delay(120);
  const job = opsJobs.get(id);
  return job ? structuredClone(job) : null;
}

export async function demoStaff(): Promise<StaffMember[]> {
  await delay();
  return [
    {
      id: DEMO_ADMIN.id,
      email: DEMO_ADMIN.email,
      displayName: DEMO_ADMIN.displayName,
      roles: ['admin'],
      totpEnabled: true,
      lastLoginAt: new Date().toISOString(),
      active: true,
    },
    {
      id: DEMO_SUPPORT.id,
      email: DEMO_SUPPORT.email,
      displayName: DEMO_SUPPORT.displayName,
      roles: ['support'],
      totpEnabled: true,
      lastLoginAt: new Date(Date.now() - 86_400_000).toISOString(),
      active: true,
    },
  ];
}

export async function demoAudit(): Promise<AuditEntry[]> {
  await delay();
  return [
    {
      id: 'au1',
      actorEmail: 'admin@beauty.local',
      action: 'ops.backup',
      entityType: 'ops_job',
      entityId: 'job-demo-1',
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
      meta: { dryRun: true },
    },
    {
      id: 'au2',
      actorEmail: 'support@beauty.local',
      action: 'accounts.update',
      entityType: 'account',
      entityId: 'a1',
      createdAt: new Date(Date.now() - 7_200_000).toISOString(),
      meta: { field: 'status', from: 'active', to: 'active' },
    },
    {
      id: 'au3',
      actorEmail: 'admin@beauty.local',
      action: 'features.toggle',
      entityType: 'feature',
      entityId: 'waiting_list',
      createdAt: new Date(Date.now() - 86_400_000).toISOString(),
      meta: { tariff: 'premium', enabled: true },
    },
  ];
}
