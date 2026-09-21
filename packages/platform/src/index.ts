export type PlatformKind = 'telegram' | 'max' | 'web';

export type PlatformUser = {
  platformUserId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
  photoUrl?: string;
};

export type AuthProvider = {
  getInitData(): string | null;
  getPlatform(): PlatformKind;
  ready(): Promise<void>;
  close?(): void;
};

export type NotificationProvider = {
  requestPermission(): Promise<boolean>;
  isSupported(): boolean;
};

export type PaymentProviderClient = {
  openInvoice?(url: string): Promise<'paid' | 'cancelled' | 'failed'>;
};

export type PlatformAdapters = {
  auth: AuthProvider;
  notifications: NotificationProvider;
  payments: PaymentProviderClient;
};

export function detectPlatform(): PlatformKind {
  const g = globalThis as typeof globalThis & {
    window?: {
      Telegram?: { WebApp?: unknown };
      WebApp?: { initData?: string };
    };
  };
  if (!g.window) return 'web';
  const w = g.window;
  if (w.Telegram?.WebApp) return 'telegram';
  if (w.WebApp?.initData && !w.Telegram?.WebApp) return 'max';
  return 'web';
}

// Server-only helpers (node:crypto) live behind the `@beauty/platform/server`
// entry point so browser bundles never pull Node built-ins into the graph.
