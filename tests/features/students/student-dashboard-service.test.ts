import { getStudentDashboardDetails } from '@/features/students/student-dashboard-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NEXT_NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';

const {
  mockGetCurrentUserID,
  mockForbidden,
  mockNotFound,
  mockGetSubjectMapByIds,
  mockGetTutorProfileMapByIds,
  mockGetParentIdByUserId,
  mockGetStudentDashboardCreditHistoryRows,
  mockGetStudentDashboardProgressReportRows,
} = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockForbidden: vi.fn(),
  mockNotFound: vi.fn(),
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
  mockGetParentIdByUserId: vi.fn(),
  mockGetStudentDashboardCreditHistoryRows: vi.fn(),
  mockGetStudentDashboardProgressReportRows: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
  notFound: mockNotFound,
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

vi.mock('@/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
}));

vi.mock('@/db/queries/students', () => ({
  getStudentDashboardCreditHistoryRows: mockGetStudentDashboardCreditHistoryRows,
  getStudentDashboardProgressReportRows: mockGetStudentDashboardProgressReportRows,
}));

function createNextNotFoundError() {
  const error = new Error(NEXT_NOT_FOUND_DIGEST);
  Object.defineProperty(error, 'digest', {
    value: NEXT_NOT_FOUND_DIGEST,
  });
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
    mockGetStudentDashboardCreditHistoryRows.mockResolvedValue([]);
    mockGetStudentDashboardProgressReportRows.mockResolvedValue([]);
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[7, { id: 7, name: 'Algebra', slug: 'algebra' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(new Map([[11, { id: 11, name: 'Alan Turing' }]]));
  });

  it('maps admin credit history and progress reports', async () => {
    mockGetStudentDashboardCreditHistoryRows.mockResolvedValueOnce([
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
    ]);
    mockGetStudentDashboardProgressReportRows.mockResolvedValueOnce([
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
    ]);

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
    expect(mockGetStudentDashboardCreditHistoryRows).toHaveBeenCalledWith({ studentId: 9, parentId: null, limit: 5 });
    expect(mockGetStudentDashboardProgressReportRows).toHaveBeenCalledWith({ studentId: 9, parentId: null, limit: 5 });
  });

  it('uses missing value fallbacks when subject or tutor lookups are absent', async () => {
    mockGetStudentDashboardProgressReportRows.mockResolvedValueOnce([
      {
        session_id: 300,
        subject_id: 999,
        tutor_id: 888,
        scheduled_at: '2026-03-10T15:00:00.000Z',
        status: 'Completed',
        report_created_at: '2026-03-10T16:00:00.000Z',
        report_updated_at: '2026-03-10T16:30:00.000Z',
        topics: null,
        homework_assigned: null,
        public_notes: null,
      },
    ]);
    mockGetSubjectMapByIds.mockResolvedValueOnce(new Map());
    mockGetTutorProfileMapByIds.mockResolvedValueOnce(new Map());

    await expect(getStudentDashboardDetails(9, 'admin')).resolves.toMatchObject({
      progressReports: [{ subject_name: '—', tutor_name: '—' }],
    });
  });

  it('looks up the current parent before loading parent-scoped dashboard data', async () => {
    mockGetCurrentUserID.mockResolvedValue(88);
    mockGetParentIdByUserId.mockResolvedValue(55);

    await expect(getStudentDashboardDetails(9, 'parent')).resolves.toEqual({
      creditHistory: [],
      progressReports: [],
    });

    expect(mockGetCurrentUserID).toHaveBeenCalledTimes(1);
    expect(mockGetParentIdByUserId).toHaveBeenCalledWith(88);
    expect(mockGetStudentDashboardCreditHistoryRows).toHaveBeenCalledWith({ studentId: 9, parentId: 55, limit: 5 });
    expect(mockGetStudentDashboardProgressReportRows).toHaveBeenCalledWith({ studentId: 9, parentId: 55, limit: 5 });
  });

  it('preserves notFound when the current parent row is missing', async () => {
    mockGetCurrentUserID.mockResolvedValue(88);
    mockGetParentIdByUserId.mockResolvedValue(null);

    await expect(getStudentDashboardDetails(9, 'parent')).rejects.toMatchObject({ digest: NEXT_NOT_FOUND_DIGEST });
    expect(mockGetStudentDashboardCreditHistoryRows).not.toHaveBeenCalled();
    expect(mockGetStudentDashboardProgressReportRows).not.toHaveBeenCalled();
  });

  it('preserves notFound for invalid student ids', async () => {
    await expect(getStudentDashboardDetails(Number.NaN, 'admin')).rejects.toMatchObject({
      digest: NEXT_NOT_FOUND_DIGEST,
    });
    expect(mockGetStudentDashboardCreditHistoryRows).not.toHaveBeenCalled();
    expect(mockGetStudentDashboardProgressReportRows).not.toHaveBeenCalled();
  });

  it('forbids tutors', async () => {
    await expect(getStudentDashboardDetails(9, 'tutor')).rejects.toThrow('forbidden');
    expect(mockGetStudentDashboardCreditHistoryRows).not.toHaveBeenCalled();
    expect(mockGetStudentDashboardProgressReportRows).not.toHaveBeenCalled();
  });

  it('rejects invalid roles before loading dashboard data', async () => {
    const invalidRole = JSON.parse('"invalid"');

    await expect(getStudentDashboardDetails(9, invalidRole)).rejects.toThrow(
      'Role is required to fetch student dashboard data.'
    );
    expect(mockGetStudentDashboardCreditHistoryRows).not.toHaveBeenCalled();
    expect(mockGetStudentDashboardProgressReportRows).not.toHaveBeenCalled();
  });
});
