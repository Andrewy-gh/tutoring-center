import { createSessionDataService, type SessionDataServiceDeps } from '@/lib/data/sessions-service';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

let deps: SessionDataServiceDeps;
let getUserRoleMock: Mock<SessionDataServiceDeps['getUserRole']>;
let getCurrentUserIDMock: Mock<SessionDataServiceDeps['getCurrentUserID']>;
let getParentIdByUserIdMock: Mock<SessionDataServiceDeps['getParentIdByUserId']>;
let getTutorIdByUserIdMock: Mock<SessionDataServiceDeps['getTutorIdByUserId']>;
let getSessionListRowsMock: Mock<SessionDataServiceDeps['getSessionListRows']>;
let getSubjectMapByIdsMock: Mock<SessionDataServiceDeps['getSubjectMapByIds']>;
let getTutorProfileMapByIdsMock: Mock<SessionDataServiceDeps['getTutorProfileMapByIds']>;
let getSessionDetailMock: Mock<SessionDataServiceDeps['getSessionDetail']>;
let getTutorAssignedSessionRowsMock: Mock<SessionDataServiceDeps['getTutorAssignedSessionRows']>;
let getStudentRecentProgressRowsMock: Mock<SessionDataServiceDeps['getStudentRecentProgressRows']>;
let notFoundMock: Mock<() => never>;
let redirectMock: Mock<(path: string) => never>;

function createDeps(): SessionDataServiceDeps {
  getUserRoleMock = vi.fn<SessionDataServiceDeps['getUserRole']>().mockResolvedValue('admin');
  getCurrentUserIDMock = vi.fn<SessionDataServiceDeps['getCurrentUserID']>().mockResolvedValue(1);
  getParentIdByUserIdMock = vi.fn<SessionDataServiceDeps['getParentIdByUserId']>().mockResolvedValue(77);
  getTutorIdByUserIdMock = vi.fn<SessionDataServiceDeps['getTutorIdByUserId']>().mockResolvedValue(101);
  getSessionListRowsMock = vi.fn<SessionDataServiceDeps['getSessionListRows']>().mockResolvedValue([]);
  getSubjectMapByIdsMock = vi
    .fn<SessionDataServiceDeps['getSubjectMapByIds']>()
    .mockResolvedValue(new Map([[1, { name: 'Mathematics' }]]));
  getTutorProfileMapByIdsMock = vi
    .fn<SessionDataServiceDeps['getTutorProfileMapByIds']>()
    .mockResolvedValue(new Map([[101, { name: 'Jane Tutor', email: 'jane@example.com', phone: '555-1111' }]]));
  getSessionDetailMock = vi.fn<SessionDataServiceDeps['getSessionDetail']>().mockResolvedValue(null);
  getTutorAssignedSessionRowsMock = vi
    .fn<SessionDataServiceDeps['getTutorAssignedSessionRows']>()
    .mockResolvedValue([]);
  getStudentRecentProgressRowsMock = vi
    .fn<SessionDataServiceDeps['getStudentRecentProgressRows']>()
    .mockResolvedValue([]);
  notFoundMock = vi.fn<() => never>(() => {
    throw new Error('notFound');
  });
  redirectMock = vi.fn<(path: string) => never>((path: string) => {
    throw new Error(`redirect:${path}`);
  });

  return {
    getUserRole: () => getUserRoleMock(),
    getCurrentUserID: () => getCurrentUserIDMock(),
    getParentIdByUserId: userId => getParentIdByUserIdMock(userId),
    getTutorIdByUserId: userId => getTutorIdByUserIdMock(userId),
    getSessionListRows: filters => getSessionListRowsMock(filters),
    getSubjectMapByIds: ids => getSubjectMapByIdsMock(ids),
    getTutorProfileMapByIds: ids => getTutorProfileMapByIdsMock(ids),
    getSessionDetail: id => getSessionDetailMock(id),
    getTutorAssignedSessionRows: tutorId => getTutorAssignedSessionRowsMock(tutorId),
    getStudentRecentProgressRows: (studentId, sessionIdToExclude, limit, nowIso) =>
      getStudentRecentProgressRowsMock(studentId, sessionIdToExclude, limit, nowIso),
    now: () => '2026-03-21T12:00:00.000Z',
    notFound: () => notFoundMock(),
    redirect: path => redirectMock(path),
  };
}

describe('getSessions', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('returns mapped sessions for admin users', async () => {
    getSessionListRowsMock.mockResolvedValueOnce([
      {
        id: 2,
        tutorId: 101,
        studentId: 201,
        subjectId: 1,
        parentId: 1,
        slotUnits: 2,
        scheduledAt: '2026-04-01T10:00:00Z',
        endsAt: '2026-04-01T11:00:00Z',
        status: 'Scheduled',
        studentParentId: 1,
        studentLearningGoals: null,
        studentFirstName: 'John',
        studentLastName: 'Student',
        studentEmail: 'john@example.com',
        parentBillingAddress: null,
        parentNotificationPreferences: null,
        parentFirstName: 'Parent',
        parentLastName: 'Name',
        parentEmail: 'parent@test.com',
      },
    ]);

    const service = createSessionDataService(deps);

    await expect(service.getSessions()).resolves.toEqual([
      {
        id: 2,
        student_name: 'John Student',
        tutor_id: 101,
        tutor_name: 'Jane Tutor',
        tutor_email: 'jane@example.com',
        student_id: 201,
        subject_id: 1,
        subject_name: 'Mathematics',
        scheduled_at: '2026-04-01T10:00:00Z',
        ends_at: '2026-04-01T11:00:00Z',
        hours: 2,
        status: 'Scheduled',
      },
    ]);
  });

  it('filters sessions for parent users via parent lookup', async () => {
    getUserRoleMock.mockResolvedValueOnce('parent');
    const service = createSessionDataService(deps);

    await expect(service.getSessions()).resolves.toEqual([]);
    expect(getCurrentUserIDMock).toHaveBeenCalledTimes(1);
    expect(getParentIdByUserIdMock).toHaveBeenCalledWith(1);
  });
});

describe('getSession', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('returns session detail for a valid id', async () => {
    getSessionDetailMock.mockResolvedValueOnce({
      id: 1,
      tutor_id: 101,
      scheduled_at: '2026-04-01T10:00:00Z',
      ends_at: '2026-04-01T11:00:00Z',
      slot_units: 2,
      status: 'Scheduled',
      subject_id: 1,
      parent_id: 77,
      student_id: 201,
      student_parent_id: 77,
      student_first_name: 'John',
      student_last_name: 'Student',
      parent_first_name: 'Parent',
      parent_last_name: 'Name',
      parent_email: 'parent@test.com',
      topics: null,
      homework_assigned: null,
      public_notes: null,
      internal_notes: null,
      confidence_score: null,
      session_performance: null,
      homework_completed: null,
      tutor_comments: null,
    });

    const service = createSessionDataService(deps);
    const session = await service.getSession(1);

    expect(session.id).toBe(1);
    expect(session.subject_name).toBe('Mathematics');
    expect(session.student.name).toBe('John Student');
  });

  it('throws notFound for invalid id', async () => {
    const service = createSessionDataService(deps);
    await expect(service.getSession(999)).rejects.toThrow('notFound');
  });

  it('redirects parent users away from another parent session', async () => {
    getUserRoleMock.mockResolvedValueOnce('parent');
    getSessionDetailMock.mockResolvedValueOnce({
      id: 1,
      tutor_id: 101,
      scheduled_at: '2026-04-01T10:00:00Z',
      ends_at: '2026-04-01T11:00:00Z',
      slot_units: 2,
      status: 'Scheduled',
      subject_id: 1,
      parent_id: 999,
      student_id: 201,
      student_parent_id: 999,
      student_first_name: 'John',
      student_last_name: 'Student',
      parent_first_name: 'Parent',
      parent_last_name: 'Name',
      parent_email: 'parent@test.com',
      topics: null,
      homework_assigned: null,
      public_notes: null,
      internal_notes: null,
      confidence_score: null,
      session_performance: null,
      homework_completed: null,
      tutor_comments: null,
    });

    const service = createSessionDataService(deps);

    await expect(service.getSession(1)).rejects.toThrow('redirect:/dashboard/sessions');
  });
});

describe('getTutorAssignedSessions', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('returns only sessions missing progress or metrics', async () => {
    getUserRoleMock.mockResolvedValueOnce('tutor');
    getCurrentUserIDMock.mockResolvedValueOnce(44);
    getTutorIdByUserIdMock.mockResolvedValueOnce(101);
    getTutorAssignedSessionRowsMock.mockResolvedValueOnce([
      {
        id: 1,
        tutor_id: 101,
        student_id: 201,
        subject_id: 1,
        scheduled_at: '2026-04-01T10:00:00Z',
        ends_at: '2026-04-01T11:00:00Z',
        status: 'Completed',
        progress_id: null,
        metrics_id: 7,
        student_first_name: 'John',
        student_last_name: 'Student',
      },
      {
        id: 2,
        tutor_id: 101,
        student_id: 202,
        subject_id: 1,
        scheduled_at: '2026-04-02T10:00:00Z',
        ends_at: '2026-04-02T11:00:00Z',
        status: 'Completed',
        progress_id: 8,
        metrics_id: 9,
        student_first_name: 'Jamie',
        student_last_name: 'Learner',
      },
    ]);

    const service = createSessionDataService(deps);

    await expect(service.getTutorAssignedSessions()).resolves.toEqual([
      {
        id: 1,
        student_name: 'John Student',
        student_id: 201,
        tutor_id: 101,
        subject_name: 'Mathematics',
        scheduled_at: '2026-04-01T10:00:00Z',
        ends_at: '2026-04-01T11:00:00Z',
        status: 'Completed',
        needsProgressReport: true,
        needsMetrics: false,
      },
    ]);
  });
});

describe('getStudentRecentProgress', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('returns an empty array when the progress query fails', async () => {
    getStudentRecentProgressRowsMock.mockRejectedValueOnce(new Error('db failed'));
    const service = createSessionDataService(deps);

    await expect(service.getStudentRecentProgress(201, 1, 5)).resolves.toEqual([]);
  });
});
