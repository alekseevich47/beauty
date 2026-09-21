import type { PlatformAdapters } from '@beauty/platform';

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  close?: () => void;
  openInvoice?: (url: string, cb: (status: string) => void) => void;
};

function getTelegram(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export function createTelegramAdapters(): PlatformAdapters {
  return {
    auth: {
      getPlatform: () => 'telegram',
      getInitData: () => getTelegram()?.initData ?? null,
      ready: async () => {
        getTelegram()?.ready?.();
      },
      close: () => getTelegram()?.close?.(),
    },
    notifications: {
      isSupported: () => false,
      requestPermission: async () => false,
    },
    payments: {
      openInvoice: async (url) =>
        new Promise((resolve) => {
          const tg = getTelegram();
          if (!tg?.openInvoice) {
            resolve('failed');
            return;
          }
          tg.openInvoice(url, (status) => {
            if (status === 'paid') resolve('paid');
            else if (status === 'cancelled') resolve('cancelled');
            else resolve('failed');
          });
        }),
    },
  };
}
