import type { PlatformAdapters } from '@beauty/platform';

type MaxWebApp = {
  initData?: string;
  ready?: () => void;
  close?: () => void;
};

function getMax(): MaxWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as Window & { WebApp?: MaxWebApp; Telegram?: { WebApp?: unknown } };
  if (w.Telegram?.WebApp) return undefined;
  return w.WebApp;
}

export function createMaxAdapters(): PlatformAdapters {
  return {
    auth: {
      getPlatform: () => 'max',
      getInitData: () => getMax()?.initData ?? null,
      ready: async () => {
        getMax()?.ready?.();
      },
      close: () => getMax()?.close?.(),
    },
    notifications: {
      isSupported: () => false,
      requestPermission: async () => false,
    },
    payments: {},
  };
}
