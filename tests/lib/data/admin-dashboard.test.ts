import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

vi.mock('@/lib/utils/normalize', () => ({
  pickFirstEmbedded: vi.fn(value => (Array.isArray(value) ? value[0] : value)),
}));

describe('admin dashboard data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('counts captured credits from session debits and leaked credits from completed sessions without them', async () => {
    let sessionSelectCalls = 0;

    const from = vi.fn((table: string) => {
      if (table === 'sessions') {
        return {
          select: vi.fn(() => {
            sessionSelectCalls += 1;

            if (sessionSelectCalls === 1) {
              return {
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn().mockResolvedValue({ count: 3, error: null }),
                  })),
                })),
              };
            }

            if (sessionSelectCalls === 2) {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { id: 201, slot_units: 2 },
                    { id: 202, slot_units: 1 },
                  ],
                  error: null,
                }),
              };
            }

            return {
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 301, slot_units: 2, credit_transactions: [{ id: 1, type: 'session_debit' }] },
                  { id: 302, slot_units: 1, credit_transactions: [] },
                ],
                error: null,
              }),
            };
          }),
        };
      }

      if (table === 'credit_transactions') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              not: vi.fn().mockResolvedValue({
                data: [{ pending_delta: -2 }, { pending_delta: -1 }],
                error: null,
              }),
            })),
          })),
        };
      }

      if (table === 'credit_balances') {
        return {
          select: vi.fn(() => ({
            lt: vi.fn().mockResolvedValue({ count: 4, error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    mockCreateSupabaseServiceClient.mockReturnValue({ from });

    const { getAdminMetrics } = await import('@/lib/data/admin-dashboard');
    const result = await getAdminMetrics();

    expect(result.sessionsTodayCount).toBe(3);
    expect(result.pendingNotesCount).toBe(2);
    expect(result.pendingNotesCreditsAtRisk).toBe(3);
    expect(result.creditsCaptured).toBe(3);
    expect(result.creditsLeaked).toBe(1);
  });

  it('returns only session ids with session debit transactions', async () => {
    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn().mockResolvedValue({
              data: [{ session_id: 10 }, { session_id: 12 }, { session_id: null }],
            }),
          })),
        })),
      })),
    });

    const { getDebitSessionIds } = await import('@/lib/data/admin-dashboard');
    await expect(getDebitSessionIds()).resolves.toEqual(new Set([10, 12]));
  });
});
