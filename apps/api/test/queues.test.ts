import { describe, expect, it } from 'vitest';
import { QUEUE_NAMES } from '../src/queues/queue-names';

describe('queue names', () => {
  it('exposes required BullMQ queues', () => {
    expect(QUEUE_NAMES.reminders).toBe('reminders');
    expect(QUEUE_NAMES.reviews).toBe('reviews');
    expect(QUEUE_NAMES.broadcasts).toBe('broadcasts');
    expect(QUEUE_NAMES.subscriptionDunning).toBe('subscription-dunning');
    expect(QUEUE_NAMES.masterOfWeek).toBe('master-of-week');
    expect(QUEUE_NAMES.mvRefresh).toBe('mv-refresh');
  });
});
