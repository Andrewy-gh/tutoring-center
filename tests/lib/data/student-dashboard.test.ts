import type { UserRole } from '@/lib/auth';
import { getStudentDashboardDetails } from '@/lib/data/student-dashboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NEXT_NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';

const {
  mockGetCurrentUserID,
  mockForbidden,
  mockNotFound,
  mockGetSubjectMapByIds,
  mockGetTutorProfileMapByIds,
  mockGetParentIdByUserId,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockForbidden: vi.fn(),
  mockNotFound: vi.fn(),
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
  mockGetParentIdByUserId: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
  notFound: mockNotFound,
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
}));

vi.mock('@/lib/data/subjects', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
}));

vi.mock('@/lib/data/tutors', () => ({
  getTutorProfileMapByIds: mockGetTutorProfileMapByIds,
}));

vi.mock('@/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
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
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createNextNotFoundError() {
  const error = new Error(NEXT_NOT_FOUND_DIGEST) as Error & { digest?: string };
  error.digest = NEXT_NOT_FOUND_DIGEST;
  return error;
}

describe('getStudentDashboardDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
    mockNotFound.mockImplementation(() => {
      throw createNextNotFoundError();
    });
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[7, { id: 7, name: 'Algebra', slug: 'algebra' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(new Map([[11, { id: 11, name: 'Alan Turing' }]]));
  });

  it('maps admin credit history and progress reports', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 20,
            created_at: '2026-03-18T12:00:00.000Z',
            type: 'session_debit',
            available_delta_minutes: 0,
            pending_delta_minutes: -60,
            available_after_minutes: 240,
            pending_after_minutes: 0,
            session_id: 300,
          },
        ])
      )
      .mockReturnValueOnce(
        createSelectQuery([
          {
            session_id: 300,
            subject_id: 7,
            tutor_id: 11,
            scheduled_at: '2026-03-10T15:00:00.000Z',
            status: 'Completed',
            report_created_at: '2026-03-10T16:00:00.000Z',
            report_updated_at: '2026-03-10T16:30:00.000Z',
            topics: 'Linear equations',
            homework_assigned: 'Worksheet 4',
            public_notes: 'Strong progress',
          },
        ])
      );

    await expect(getStudentDashboardDetails(9, 'admin')).resolves.toEqual({
      creditHistory: [
        {
          id: 20,
          created_at: '2026-03-18T12:00:00.000Z',
          type: 'session_debit',
          available_delta_minutes: 0,
          pending_delta_minutes: -60,
          available_after_minutes: 240,
          pending_after_minutes: 0,
          net_amount: -60,
          summary: 'Used 1 credit',
          session_id: 300,
        },
      ],
      progressReports: [
        {
          session_id: 300,
          scheduled_at: '2026-03-10T15:00:00.000Z',
          status: 'Completed',
          subject_name: 'Algebra',
          tutor_name: 'Alan Turing',
          report_created_at: '2026-03-10T16:00:00.000Z',
          report_updated_at: '2026-03-10T16:30:00.000Z',
          topics: 'Linear equations',
          homework_assigned: 'Worksheet 4',
          public_notes: 'Strong progress',
        },
      ],
    });
  });

  it('looks up the current parent before loading parent-scoped dashboard data', async () => {
    mockGetCurrentUserID.mockResolvedValue(88);
    mockGetParentIdByUserId.mockResolvedValue(55);
    mockDbSelect.mockReturnValueOnce(createSelectQuery([])).mockReturnValueOnce(createSelectQuery([]));

    await expect(getStudentDashboardDetails(9, 'parent')).resolves.toEqual({
      creditHistory: [],
      progressReports: [],
    });

    expect(mockGetCurrentUserID).toHaveBeenCalledTimes(1);
    expect(mockGetParentIdByUserId).toHaveBeenCalledWith(88);
  });

  it('preserves notFound when the current parent row is missing', async () => {
    mockGetCurrentUserID.mockResolvedValue(88);
    mockGetParentIdByUserId.mockResolvedValue(null);

    await expect(getStudentDashboardDetails(9, 'parent')).rejects.toMatchObject({ digest: NEXT_NOT_FOUND_DIGEST });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('forbids tutors', async () => {
    await expect(getStudentDashboardDetails(9, 'tutor')).rejects.toThrow('forbidden');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('rejects invalid roles before loading dashboard data', async () => {
    await expect(getStudentDashboardDetails(9, 'invalid' as UserRole)).rejects.toThrow(
      'Role is required to fetch student dashboard data.'
    );
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
