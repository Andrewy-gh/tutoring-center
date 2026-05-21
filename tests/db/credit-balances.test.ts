import { deductCreditBalance, getCreditBalanceByParentId } from '@/db/queries/credits/balances';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({
  db: {
    async execute() {
      throw new Error('Unexpected default db.execute call');
    },
  },
}));

function createQueuedExecutor(responses: unknown[]) {
  let index = 0;

  return {
    async execute<T>() {
      const response = responses[index];
      index += 1;

      if (response === undefined) {
        throw new Error(`Unexpected execute call ${index}`);
      }

      return response as T;
    },
  };
}

describe('credit balance queries', () => {
  it('returns the current credit balance row for a parent', async () => {
    const database = createQueuedExecutor([[{ parent_id: 1010, available_minutes: 10, pending_minutes: 5 }]]);

    await expect(getCreditBalanceByParentId(1010, database)).resolves.toEqual({
      parent_id: 1010,
      available_minutes: 10,
      pending_minutes: 5,
    });
  });

  it('returns null when no credit balance row exists', async () => {
    const database = createQueuedExecutor([[]]);

    await expect(getCreditBalanceByParentId(9999, database)).resolves.toBeNull();
  });

  it('updates the balance row when sufficient credits are available', async () => {
    const database = createQueuedExecutor([[{ available_minutes: 7, pending_minutes: 8 }]]);

    await expect(deductCreditBalance(1010, 3, database)).resolves.toEqual({
      available_minutes: 7,
      pending_minutes: 8,
    });
  });

  it('returns null when the balance update does not match a row', async () => {
    const database = createQueuedExecutor([[]]);

    await expect(deductCreditBalance(9999, 3, database)).resolves.toBeNull();
  });
});
