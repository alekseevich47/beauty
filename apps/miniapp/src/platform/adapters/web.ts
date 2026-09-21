import type { PlatformAdapters } from '@beauty/platform';

export function createWebAdapters(): PlatformAdapters {
  return {
    auth: {
      getPlatform: () => 'web',
      getInitData: () => (import.meta.env.VITE_DEMO_MODE === 'true' ? 'demo-init' : null),
      ready: async () => undefined,
    },
    notifications: {
      isSupported: () => typeof Notification !== 'undefined',
      requestPermission: async () => {
        if (typeof Notification === 'undefined') return false;
        const result = await Notification.requestPermission();
        return result === 'granted';
      },
    },
    payments: {},
  };
}
