export const QUEUE_NAMES = {
  reminders: 'reminders',
  reviews: 'reviews',
  broadcasts: 'broadcasts',
  subscriptionDunning: 'subscription-dunning',
  masterOfWeek: 'master-of-week',
  mvRefresh: 'mv-refresh',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
