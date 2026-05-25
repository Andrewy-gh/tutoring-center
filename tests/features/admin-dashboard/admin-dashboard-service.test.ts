import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getCompletedSessionDebitRowsSince,
  getDebitTransactionRows,
  getDebitTransactionRowsSince,
  getPendingNoteSessionRowsSince,
  getScheduledSessionsCountBetween,
} = vi.hoisted(() => ({
  getAtRiskParentCountRows: vi.fn(),
  getAtRiskParentRows: vi.fn(),
  getCompletedSessionDebitRowsSince: vi.fn(),
  getDebitTransactionRows: vi.fn(),
  getDebitTransactionRowsSince: vi.fn(),
  getPendingNoteSessionRowsSince: vi.fn(),
  getScheduledSessionsCountBetween: vi.fn(),
}));

vi.mock('@/db/queries/admin-dashboard', () => ({
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getCompletedSessionDebitRowsSince,
  getDebitTransactionRows,
  getDebitTransactionRowsSince,
  getPendingNoteSessionRowsSince,
  getScheduledSessionsCountBetween,
}));

describe('admin dashboard service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts captured credits by debit date and leaked credits by recent completed sessions without debits', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T15:00:00.000Z'));
    getScheduledSessionsCountBetween.mockResolvedValue([{ count: 3 }]);
    getPendingNoteSessionRowsSince.mockResolvedValue([
      { id: 201, slot_units: 2 },
      { id: 202, slot_units: 1 },
    ]);
    getDebitTransactionRowsSince.mockResolvedValue([
      { session_id: 301, pending_delta_minutes: -60 },
      { session_id: 303, pending_delta_minutes: -30 },
    ]);
    getCompletedSessionDebitRowsSince.mockResolvedValue([{ id: 302, slot_units: 1, debit_transaction_id: null }]);
    getAtRiskParentCountRows.mockResolvedValue([{ count: 4 }]);

    const { getAdminMetrics } = await import('@/features/admin-dashboard/admin-dashboard-service');
    const result = await getAdminMetrics();

    expect(result.sessionsTodayCount).toBe(3);
    expect(result.pendingNotesCount).toBe(2);
    expect(result.pendingNotesCreditsAtRisk).toBe(1.5);
    expect(result.creditsCaptured).toBe(1.5);
    expect(result.creditsLeaked).toBe(0.5);
    expect(result.atRiskParentsCount).toBe(4);
    expect(getPendingNoteSessionRowsSince).toHaveBeenCalledWith(new Date('2026-04-24T15:00:00.000Z'));
    expect(getDebitTransactionRowsSince).toHaveBeenCalledWith(new Date('2026-04-24T15:00:00.000Z'));
    expect(getCompletedSessionDebitRowsSince).toHaveBeenCalledWith(new Date('2026-04-24T15:00:00.000Z'));
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
