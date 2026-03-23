import { deductCreditBalance, getCreditBalanceByParentId } from '@/lib/db/queries/credits/balances';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({
  db: {
    async execute() {
      throw new Error('Unexpected default db.execute call');
    },
  },
}));

type QueuedExecutor = {
  execute<T>(query: unknown): Promise<T>;
};

function createQueuedExecutor(responses: unknown[]): QueuedExecutor {
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
    const database = createQueuedExecutor([[{ parent_id: 1010, amount_available: 10, amount_pending: 5 }]]);

    await expect(getCreditBalanceByParentId(1010, database)).resolves.toEqual({
      parent_id: 1010,
      amount_available: 10,
      amount_pending: 5,
    });
  });

  it('returns null when no credit balance row exists', async () => {
    const database = createQueuedExecutor([[]]);

    await expect(getCreditBalanceByParentId(9999, database)).resolves.toBeNull();
  });

  it('updates the balance row when sufficient credits are available', async () => {
    const database = createQueuedExecutor([[{ amount_available: 7, amount_pending: 8 }]]);

    await expect(deductCreditBalance(1010, 3, database)).resolves.toEqual({
      amount_available: 7,
      amount_pending: 8,
    });
  });

  it('returns null when the balance update does not match a row', async () => {
    const database = createQueuedExecutor([[]]);

    await expect(deductCreditBalance(9999, 3, database)).resolves.toBeNull();
  });
});
