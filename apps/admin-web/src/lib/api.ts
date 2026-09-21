import { staffLoginSchema, staffTotpSchema } from '@beauty/contracts';

import {
  demoAccounts,
  demoAudit,
  demoCreateOpsJob,
  demoFeatures,
  demoGetOpsJob,
  demoLogin,
  demoLogout,
  demoMessages,
  demoMetrics,
  demoSendMessage,
  demoSession,
  demoStaff,
  demoThreads,
  demoVerifyTotp,
  isDemoMode,
} from '@/lib/demo';
import type {
  AccountSummary,
  ApiErrorBody,
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
} from '@/types/staff';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(
      res.status,
      body.error?.code ?? 'unknown',
      body.error?.message ?? res.statusText,
      body.error?.requestId,
    );
  } catch {
    return new ApiError(res.status, 'http_error', res.statusText || 'Request failed');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Demo data is only ever served when demo mode is explicitly enabled.
 * Falling back on API errors would silently present fabricated accounts, metrics
 * and sessions as if they were production data whenever the staff API misroutes.
 */
function shouldUseDemo(_err?: unknown): boolean {
  return isDemoMode();
}

export const api = {
  async login(email: string, password: string): Promise<LoginChallenge> {
    const payload = staffLoginSchema.parse({ email, password });
    if (isDemoMode()) return demoLogin(payload.email, payload.password);
    try {
      return await request<LoginChallenge>('/api/v1/staff/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (shouldUseDemo(err)) return demoLogin(payload.email, payload.password);
      throw err;
    }
  },

  async verifyTotp(challengeId: string, code: string): Promise<SessionResponse> {
    const payload = staffTotpSchema.parse({ challengeId, code });
    if (isDemoMode()) return demoVerifyTotp(payload.challengeId, payload.code);
    try {
      return await request<SessionResponse>('/api/v1/staff/auth/totp', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (shouldUseDemo(err)) return demoVerifyTotp(payload.challengeId, payload.code);
      throw err;
    }
  },

  async session(): Promise<SessionResponse | null> {
    if (isDemoMode()) return demoSession();
    try {
      return await request<SessionResponse>('/api/v1/staff/auth/session');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      if (shouldUseDemo(err)) return demoSession();
      throw err;
    }
  },

  async logout(): Promise<void> {
    if (isDemoMode()) return demoLogout();
    try {
      await request<void>('/api/v1/staff/auth/logout', { method: 'POST' });
    } catch (err) {
      if (shouldUseDemo(err)) return demoLogout();
      throw err;
    }
  },

  async accounts(q?: string): Promise<AccountSummary[]> {
    if (isDemoMode()) return demoAccounts(q);
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : '';
      return await request<AccountSummary[]>(`/api/v1/staff/accounts${qs}`);
    } catch (err) {
      if (shouldUseDemo(err)) return demoAccounts(q);
      throw err;
    }
  },

  async threads(): Promise<ChatThread[]> {
    if (isDemoMode()) return demoThreads();
    try {
      return await request<ChatThread[]>('/api/v1/staff/chat/threads');
    } catch (err) {
      if (shouldUseDemo(err)) return demoThreads();
      throw err;
    }
  },

  async messages(threadId: string): Promise<ChatMessage[]> {
    if (isDemoMode()) return demoMessages(threadId);
    try {
      return await request<ChatMessage[]>(`/api/v1/staff/chat/threads/${threadId}/messages`);
    } catch (err) {
      if (shouldUseDemo(err)) return demoMessages(threadId);
      throw err;
    }
  },

  async sendMessage(threadId: string, body: string, authorName: string): Promise<ChatMessage> {
    if (isDemoMode()) return demoSendMessage(threadId, body, authorName);
    try {
      return await request<ChatMessage>(`/api/v1/staff/chat/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    } catch (err) {
      if (shouldUseDemo(err)) return demoSendMessage(threadId, body, authorName);
      throw err;
    }
  },

  async metrics(): Promise<MetricPoint[]> {
    if (isDemoMode()) return demoMetrics();
    try {
      return await request<MetricPoint[]>('/api/v1/staff/ops/metrics');
    } catch (err) {
      if (shouldUseDemo(err)) return demoMetrics();
      throw err;
    }
  },

  async features(): Promise<FeatureFlagRow[]> {
    if (isDemoMode()) return demoFeatures();
    try {
      return await request<FeatureFlagRow[]>('/api/v1/staff/features');
    } catch (err) {
      if (shouldUseDemo(err)) return demoFeatures();
      throw err;
    }
  },

  async createOpsJob(kind: OpsJobKind, dryRun: boolean): Promise<OpsJob> {
    if (isDemoMode()) return demoCreateOpsJob(kind, dryRun);
    try {
      return await request<OpsJob>('/api/v1/staff/ops/jobs', {
        method: 'POST',
        body: JSON.stringify({ kind, dryRun }),
      });
    } catch (err) {
      if (shouldUseDemo(err)) return demoCreateOpsJob(kind, dryRun);
      throw err;
    }
  },

  async getOpsJob(id: string): Promise<OpsJob | null> {
    if (isDemoMode()) return demoGetOpsJob(id);
    try {
      return await request<OpsJob>(`/api/v1/staff/ops/jobs/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      if (shouldUseDemo(err)) return demoGetOpsJob(id);
      throw err;
    }
  },

  async staff(): Promise<StaffMember[]> {
    if (isDemoMode()) return demoStaff();
    try {
      return await request<StaffMember[]>('/api/v1/staff/users');
    } catch (err) {
      if (shouldUseDemo(err)) return demoStaff();
      throw err;
    }
  },

  async audit(): Promise<AuditEntry[]> {
    if (isDemoMode()) return demoAudit();
    try {
      return await request<AuditEntry[]>('/api/v1/staff/audit');
    } catch (err) {
      if (shouldUseDemo(err)) return demoAudit();
      throw err;
    }
  },
};
