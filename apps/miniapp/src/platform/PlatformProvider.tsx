import type {
  AuthProvider,
  NotificationProvider,
  PaymentProviderClient,
  PlatformAdapters,
  PlatformKind,
  PlatformUser,
} from '@beauty/platform';
import { detectPlatform } from '@beauty/platform';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createMaxAdapters } from './adapters/max';
import { createTelegramAdapters } from './adapters/telegram';
import { createWebAdapters } from './adapters/web';

export type PlatformContextValue = {
  kind: PlatformKind;
  adapters: PlatformAdapters;
  user: PlatformUser | null;
  ready: boolean;
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

function pickAdapters(kind: PlatformKind): PlatformAdapters {
  switch (kind) {
    case 'telegram':
      return createTelegramAdapters();
    case 'max':
      return createMaxAdapters();
    default:
      return createWebAdapters();
  }
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const kind = useMemo(() => detectPlatform(), []);
  const adapters = useMemo(() => pickAdapters(kind), [kind]);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<PlatformUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await adapters.auth.ready();
      if (cancelled) return;
      const demoUser: PlatformUser = {
        platformUserId: 'demo-user',
        firstName: kind === 'web' ? 'Алина' : undefined,
        username: 'beauty_demo',
        languageCode: 'ru',
      };
      // Adapters may enrich user later; demo fallback keeps UI usable offline.
      setUser(await resolveUser(adapters.auth, demoUser));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [adapters, kind]);

  const value = useMemo(() => ({ kind, adapters, user, ready }), [kind, adapters, user, ready]);

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

async function resolveUser(auth: AuthProvider, fallback: PlatformUser): Promise<PlatformUser> {
  const init = auth.getInitData();
  if (!init) return fallback;
  // In demo / without backend we keep a stable local identity.
  return { ...fallback, platformUserId: `init:${init.slice(0, 12)}` };
}

export function usePlatform(): PlatformContextValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}

export type { AuthProvider, NotificationProvider, PaymentProviderClient, PlatformAdapters };
