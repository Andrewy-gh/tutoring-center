import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCurrentUserID,
  mockIsValidRole,
  mockCreateSupabaseServiceClient,
  mockPickFirstEmbedded,
  mockGetSubjectMapByIds,
  mockGetTutorProfileMapByIds,
} = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockIsValidRole: vi.fn(),
  mockCreateSupabaseServiceClient: vi.fn(),
  mockPickFirstEmbedded: vi.fn((value: unknown) => (Array.isArray(value) ? value[0] : value)),
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
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
  isValidRole: mockIsValidRole,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

vi.mock('@/lib/data/subjects', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
}));

vi.mock('@/lib/data/tutors', () => ({
  getTutorProfileMapByIds: mockGetTutorProfileMapByIds,
}));

vi.mock('@/lib/utils/normalize', () => ({
  pickFirstEmbedded: mockPickFirstEmbedded,
}));

describe('credit transaction data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsValidRole.mockReturnValue(true);
    mockGetCurrentUserID.mockResolvedValue(42);
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[12, { id: 12, name: 'Mathematics', slug: 'mathematics' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(new Map([[3, { id: 3, name: 'Taylor Tutor' }]]));
  });

  it('maps joined list data for admin users', async () => {
    const orderedResult = {
      data: [
        {
          id: 10,
          created_at: '2026-03-10T15:00:00.000Z',
          type: 'purchase',
          available_delta: 10,
          pending_delta: 0,
          available_after: 20,
          pending_after: 0,
          parent_id: 1,
          session_id: null,
          parent: { users: { first_name: 'Pat', last_name: 'Parent' } },
          session: null,
        },
      ],
      error: null,
    };

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          order: vi.fn(() => orderedResult),
        })),
      })),
    });

    const { getCreditTransactions } = await import('@/lib/data/credit-transactions');
    const result = await getCreditTransactions('admin');

    expect(result).toEqual([
      {
        id: 10,
        created_at: '2026-03-10T15:00:00.000Z',
        type: 'purchase',
        available_delta: 10,
        pending_delta: 0,
        available_after: 20,
        pending_after: 0,
        net_amount: 10,
        parent_name: 'Pat Parent',
        student_name: '—',
        session_id: null,
      },
    ]);
  });

  it('filters detail lookup to the current parent and maps linked session data', async () => {
    const parentLookupSingle = vi.fn().mockResolvedValue({ data: { id: 77 }, error: null });
    const parentLookupEq = vi.fn(() => ({ single: parentLookupSingle }));
    const parentLookupSelect = vi.fn(() => ({ eq: parentLookupEq }));

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 99,
        created_at: '2026-03-10T15:00:00.000Z',
        type: 'reservation',
        available_delta: -1,
        pending_delta: 1,
        available_after: 9,
        pending_after: 1,
        parent_id: 77,
        session_id: 500,
        note: null,
        parent: {
          id: 77,
          user_id: 42,
          users: { first_name: 'Pat', last_name: 'Parent', email: 'pat@example.com', phone: '555-1111' },
        },
        session: {
          id: 500,
          subject_id: 12,
          tutor_id: 3,
          scheduled_at: '2026-03-10T15:00:00.000Z',
          ends_at: '2026-03-10T16:00:00.000Z',
          status: 'Completed',
          student: {
            id: 12,
            user_id: 52,
            grade: '8',
            users: { first_name: 'Sam', last_name: 'Student', email: 'sam@example.com', phone: '555-2222' },
          },
        },
      },
      error: null,
    });
    const detailParentEq = vi.fn(() => ({ maybeSingle }));
    const detailIdEq = vi.fn(() => ({ eq: detailParentEq, maybeSingle }));
    const detailSelect = vi.fn(() => ({ eq: detailIdEq }));

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'parents') {
          return { select: parentLookupSelect };
        }

        if (table === 'credit_transactions') {
          return { select: detailSelect };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    });

    const { getCreditTransaction } = await import('@/lib/data/credit-transactions');
    const detail = await getCreditTransaction(99, 'parent');

    expect(parentLookupEq).toHaveBeenCalledWith('user_id', 42);
    expect(detailIdEq).toHaveBeenCalledWith('id', 99);
    expect(detailParentEq).toHaveBeenCalledWith('parent_id', 77);
    expect(detail.parent.name).toBe('Pat Parent');
    expect(detail.student?.name).toBe('Sam Student');
    expect(detail.session?.subject_name).toBe('Mathematics');
    expect(mockGetTutorProfileMapByIds).toHaveBeenCalledWith([3]);
    expect(detail.session?.tutor_name).toBe('Taylor Tutor');
    expect(detail.net_amount).toBe(0);
  });
});
