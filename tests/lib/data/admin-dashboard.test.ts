import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('admin dashboard data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('counts captured credits from session debits and leaked credits from completed sessions without them', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ count: 3 }]))
      .mockReturnValueOnce(
        createSelectQuery([
          { id: 201, slot_units: 2 },
          { id: 202, slot_units: 1 },
        ])
      )
      .mockReturnValueOnce(createSelectQuery([{ pending_delta: -2 }, { pending_delta: -1 }]))
      .mockReturnValueOnce(
        createSelectQuery([
          { id: 301, slot_units: 2, debit_transaction_id: 1 },
          { id: 302, slot_units: 1, debit_transaction_id: null },
        ])
      )
      .mockReturnValueOnce(createSelectQuery([{ count: 4 }]));

    const { getAdminMetrics } = await import('@/lib/data/admin-dashboard');
    const result = await getAdminMetrics();

    expect(result.sessionsTodayCount).toBe(3);
    expect(result.pendingNotesCount).toBe(2);
    expect(result.pendingNotesCreditsAtRisk).toBe(3);
    expect(result.creditsCaptured).toBe(3);
    expect(result.creditsLeaked).toBe(1);
    expect(result.atRiskParentsCount).toBe(4);
  });

  it('returns only session ids with session debit transactions', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ session_id: 10 }, { session_id: 12 }]));

    const { getDebitSessionIds } = await import('@/lib/data/admin-dashboard');
    await expect(getDebitSessionIds()).resolves.toEqual(new Set([10, 12]));
  });
});
