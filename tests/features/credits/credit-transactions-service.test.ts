import type { UserRole } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUserID, mockGetSubjectMapByIds, mockGetTutorProfileMapByIds, mockDbSelect } = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: vi.fn(() => {
    throw new Error('forbidden');
  }),
  notFound: vi.fn(() => {
    throw new Error('notFound');
  }),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
}));

vi.mock('@/features/subjects/subjects-service', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
}));

vi.mock('@/features/tutors/tutors-service', () => ({
  getTutorProfileMapByIds: mockGetTutorProfileMapByIds,
}));

vi.mock('@/db/client', () => ({
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
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('credit transaction data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCurrentUserID.mockResolvedValue(42);
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[12, { id: 12, name: 'Mathematics', slug: 'mathematics' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(new Map([[3, { id: 3, name: 'Taylor Tutor' }]]));
  });

  it('maps joined list data for admin users', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        {
          id: 10,
          created_at: '2026-03-10T15:00:00.000Z',
          type: 'purchase',
          available_delta_minutes: 120,
          pending_delta_minutes: 0,
          available_after_minutes: 240,
          pending_after_minutes: 0,
          session_id: null,
          parent_first_name: 'Pat',
          parent_last_name: 'Parent',
          student_id: null,
          student_first_name: null,
          student_last_name: null,
        },
      ])
    );

    const { getCreditTransactions } = await import('@/features/credits/transactions/credit-transactions-service');
    const result = await getCreditTransactions('admin');

    expect(result).toEqual([
      {
        id: 10,
        created_at: '2026-03-10T15:00:00.000Z',
        type: 'purchase',
        available_delta_minutes: 120,
        pending_delta_minutes: 0,
        available_after_minutes: 240,
        pending_after_minutes: 0,
        net_amount: 120,
        parent_name: 'Pat Parent',
        student_name: '—',
        session_id: null,
      },
    ]);
  });

  it('rejects invalid roles before listing transactions', async () => {
    const { getCreditTransactions } = await import('@/features/credits/transactions/credit-transactions-service');

    await expect(getCreditTransactions('invalid' as UserRole)).rejects.toThrow(
      'Role is required to fetch credit transactions.'
    );
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('filters detail lookup to the current parent and maps linked session data', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 77 }])).mockReturnValueOnce(
      createSelectQuery([
        {
          id: 99,
          created_at: '2026-03-10T15:00:00.000Z',
          type: 'reservation',
          available_delta_minutes: -60,
          pending_delta_minutes: 60,
          available_after_minutes: 180,
          pending_after_minutes: 60,
          session_id: 500,
          note: null,
          parent_id: 77,
          parent_first_name: 'Pat',
          parent_last_name: 'Parent',
          parent_email: 'pat@example.com',
          parent_phone: '555-1111',
          session_subject_id: 12,
          session_tutor_id: 3,
          scheduled_at: '2026-03-10T15:00:00.000Z',
          ends_at: '2026-03-10T16:00:00.000Z',
          status: 'Completed',
          student_id: 12,
          student_first_name: 'Sam',
          student_last_name: 'Student',
          student_email: 'sam@example.com',
          student_phone: '555-2222',
          student_grade: '8',
        },
      ])
    );

    const { getCreditTransaction } = await import('@/features/credits/transactions/credit-transactions-service');
    const detail = await getCreditTransaction(99, 'parent');

    expect(detail.parent.name).toBe('Pat Parent');
    expect(detail.student?.name).toBe('Sam Student');
    expect(detail.session?.subject_name).toBe('Mathematics');
    expect(detail.session?.tutor_name).toBe('Taylor Tutor');
    expect(detail.net_amount).toBe(0);
  });

  it('rejects invalid roles before loading transaction details', async () => {
    const { getCreditTransaction } = await import('@/features/credits/transactions/credit-transactions-service');

    await expect(getCreditTransaction(99, 'invalid' as UserRole)).rejects.toThrow(
      'Role is required to fetch credit transactions.'
    );
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
