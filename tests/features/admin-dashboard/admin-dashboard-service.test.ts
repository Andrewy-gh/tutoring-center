import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getCompletedSessionDebitRows,
  getDebitTransactionRows,
  getPendingNoteSessionRows,
  getScheduledSessionsCountBetween,
} = vi.hoisted(() => ({
  getAtRiskParentCountRows: vi.fn(),
  getAtRiskParentRows: vi.fn(),
  getCompletedSessionDebitRows: vi.fn(),
  getDebitTransactionRows: vi.fn(),
  getPendingNoteSessionRows: vi.fn(),
  getScheduledSessionsCountBetween: vi.fn(),
}));

vi.mock('@/db/queries/admin-dashboard', () => ({
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getCompletedSessionDebitRows,
  getDebitTransactionRows,
  getPendingNoteSessionRows,
  getScheduledSessionsCountBetween,
}));

describe('admin dashboard service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('counts captured credits from session debits and leaked credits from completed sessions without them', async () => {
    getScheduledSessionsCountBetween.mockResolvedValue([{ count: 3 }]);
    getPendingNoteSessionRows.mockResolvedValue([
      { id: 201, slot_units: 2 },
      { id: 202, slot_units: 1 },
    ]);
    getDebitTransactionRows.mockResolvedValue([
      { session_id: 301, pending_delta_minutes: -60 },
      { session_id: 302, pending_delta_minutes: -30 },
    ]);
    getCompletedSessionDebitRows.mockResolvedValue([
      { id: 301, slot_units: 2, debit_transaction_id: 1 },
      { id: 302, slot_units: 1, debit_transaction_id: null },
    ]);
    getAtRiskParentCountRows.mockResolvedValue([{ count: 4 }]);

    const { getAdminMetrics } = await import('@/features/admin-dashboard/admin-dashboard-service');
    const result = await getAdminMetrics();

    expect(result.sessionsTodayCount).toBe(3);
    expect(result.pendingNotesCount).toBe(2);
    expect(result.pendingNotesCreditsAtRisk).toBe(1.5);
    expect(result.creditsCaptured).toBe(1.5);
    expect(result.creditsLeaked).toBe(0.5);
    expect(result.atRiskParentsCount).toBe(4);
  }, 10000);

  it('returns only session ids with session debit transactions', async () => {
    getDebitTransactionRows.mockResolvedValue([
      { session_id: 10, pending_delta_minutes: -60 },
      { session_id: 12, pending_delta_minutes: -30 },
    ]);

    const { getDebitSessionIds } = await import('@/features/admin-dashboard/admin-dashboard-service');
    await expect(getDebitSessionIds()).resolves.toEqual(new Set([10, 12]));
  }, 10000);

  it('maps at-risk parents and falls back to an empty list on query failure', async () => {
    getAtRiskParentRows.mockResolvedValueOnce([
      {
        parent_id: 7,
        first_name: 'Pat',
        last_name: 'Parent',
        email: 'pat@example.com',
        available_minutes: 60,
      },
    ]);

    const { getAtRiskParents } = await import('@/features/admin-dashboard/admin-dashboard-service');
    await expect(getAtRiskParents()).resolves.toEqual([
      {
        parent_id: 7,
        name: 'Pat Parent',
        email: 'pat@example.com',
        available_minutes: 60,
        available_hours: '1',
      },
    ]);

    getAtRiskParentRows.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(getAtRiskParents()).resolves.toEqual([]);
  }, 10000);
});
