import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getBilledDashboardSessionRowsSince,
  getCompletedSessionDebitRowsSince,
  getDashboardSessionRowsBetween,
  getDebitTransactionRows,
  getPendingBillingDashboardSessionRowsSince,
  getPendingNoteDashboardSessionRowsSince,
  getPendingNoteSessionRowsSince,
  getScheduledSessionsCountBetween,
} = vi.hoisted(() => ({
  getAtRiskParentCountRows: vi.fn(),
  getAtRiskParentRows: vi.fn(),
  getBilledDashboardSessionRowsSince: vi.fn(),
  getCompletedSessionDebitRowsSince: vi.fn(),
  getDashboardSessionRowsBetween: vi.fn(),
  getDebitTransactionRows: vi.fn(),
  getPendingBillingDashboardSessionRowsSince: vi.fn(),
  getPendingNoteDashboardSessionRowsSince: vi.fn(),
  getPendingNoteSessionRowsSince: vi.fn(),
  getScheduledSessionsCountBetween: vi.fn(),
}));

vi.mock('@/db/queries/admin-dashboard', () => ({
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getBilledDashboardSessionRowsSince,
  getCompletedSessionDebitRowsSince,
  getDashboardSessionRowsBetween,
  getDebitTransactionRows,
  getPendingBillingDashboardSessionRowsSince,
  getPendingNoteDashboardSessionRowsSince,
  getPendingNoteSessionRowsSince,
  getScheduledSessionsCountBetween,
}));

const { getSubjectMapByIds, getTutorProfileMapByIds } = vi.hoisted(() => ({
  getSubjectMapByIds: vi.fn(),
  getTutorProfileMapByIds: vi.fn(),
}));

vi.mock('@/features/subjects/subjects-service', () => ({
  getSubjectMapByIds,
}));

vi.mock('@/features/tutors/tutors-service', () => ({
  getTutorProfileMapByIds,
}));

describe('admin dashboard service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts captured credits from session debits and leaked credits from completed sessions without them', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T15:00:00.000Z'));
    getScheduledSessionsCountBetween.mockResolvedValue([{ count: 3 }]);
    getPendingNoteSessionRowsSince.mockResolvedValue([
      { id: 201, slot_units: 2 },
      { id: 202, slot_units: 1 },
    ]);
    getCompletedSessionDebitRowsSince.mockResolvedValue([
      { id: 301, slot_units: 2, debit_transaction_id: 1, pending_delta_minutes: -60 },
      { id: 303, slot_units: 1, debit_transaction_id: 2, pending_delta_minutes: -30 },
      { id: 302, slot_units: 1, debit_transaction_id: null, pending_delta_minutes: null },
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
    expect(getPendingNoteSessionRowsSince).toHaveBeenCalledWith(new Date('2026-04-24T15:00:00.000Z'));
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

  it('loads only the active dashboard session view and maps rows for the table', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T15:00:00.000Z'));
    getPendingNoteDashboardSessionRowsSince.mockResolvedValueOnce([
      {
        id: 102,
        tutor_id: 2,
        student_id: 12,
        subject_id: 22,
        parent_id: 32,
        slot_units: 2,
        scheduled_at: '2026-05-20T14:00:00.000Z',
        ends_at: '2026-05-20T15:00:00.000Z',
        status: 'Pending-Notes',
        student_parent_id: 32,
        student_learning_goals: null,
        student_first_name: 'Student',
        student_last_name: 'Two',
        student_email: 'student@example.com',
        parent_billing_address: null,
        parent_notification_preferences: null,
        parent_first_name: 'Pat',
        parent_last_name: 'Parent',
        parent_email: 'pat@example.com',
      },
    ]);
    getSubjectMapByIds.mockResolvedValueOnce(new Map([[22, { name: 'Science' }]]));
    getTutorProfileMapByIds.mockResolvedValueOnce(
      new Map([[2, { name: 'Tutor Two', email: 'tutor2@example.com', phone: '555-0101' }]])
    );

    const { getAdminDashboardSessions } = await import('@/features/admin-dashboard/admin-dashboard-service');
    await expect(getAdminDashboardSessions('pending-notes')).resolves.toEqual([
      {
        id: 102,
        student_name: 'Student Two',
        tutor_id: 2,
        tutor_name: 'Tutor Two',
        tutor_email: 'tutor2@example.com',
        student_id: 12,
        subject_id: 22,
        subject_name: 'Science',
        scheduled_at: '2026-05-20T14:00:00.000Z',
        ends_at: '2026-05-20T15:00:00.000Z',
        hours: 1,
        status: 'Pending-Notes',
      },
    ]);

    expect(getPendingNoteDashboardSessionRowsSince).toHaveBeenCalledWith(new Date('2026-04-24T15:00:00.000Z'));
    expect(getDashboardSessionRowsBetween).not.toHaveBeenCalled();
    expect(getBilledDashboardSessionRowsSince).not.toHaveBeenCalled();
    expect(getPendingBillingDashboardSessionRowsSince).not.toHaveBeenCalled();
  }, 10000);

  it('loads pending billing sessions inside the shared revenue window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-24T15:00:00.000Z'));
    getPendingBillingDashboardSessionRowsSince.mockResolvedValueOnce([]);

    const { getAdminDashboardSessions } = await import('@/features/admin-dashboard/admin-dashboard-service');
    await expect(getAdminDashboardSessions('sessions-pending-billing')).resolves.toEqual([]);

    expect(getPendingBillingDashboardSessionRowsSince).toHaveBeenCalledWith(new Date('2026-04-24T15:00:00.000Z'));
  }, 10000);
});
