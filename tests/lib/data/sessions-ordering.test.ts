import { createSessionDataService, type SessionDataServiceDeps } from '@/lib/data/sessions-service';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

let deps: SessionDataServiceDeps;
let getSessionListRowsMock: Mock<SessionDataServiceDeps['getSessionListRows']>;
let getSubjectMapByIdsMock: Mock<SessionDataServiceDeps['getSubjectMapByIds']>;
let getTutorProfileMapByIdsMock: Mock<SessionDataServiceDeps['getTutorProfileMapByIds']>;

function createDeps(): SessionDataServiceDeps {
  getSessionListRowsMock = vi.fn<SessionDataServiceDeps['getSessionListRows']>().mockResolvedValue([]);
  getSubjectMapByIdsMock = vi.fn<SessionDataServiceDeps['getSubjectMapByIds']>().mockResolvedValue(new Map());
  getTutorProfileMapByIdsMock = vi.fn<SessionDataServiceDeps['getTutorProfileMapByIds']>().mockResolvedValue(new Map());

  return {
    getUserRole: async () => 'admin',
    getCurrentUserID: async () => 1,
    getParentIdByUserId: async () => 1,
    getTutorIdByUserId: async () => 1,
    getSessionListRows: filters => getSessionListRowsMock(filters),
    getSubjectMapByIds: ids => getSubjectMapByIdsMock(ids),
    getTutorProfileMapByIds: ids => getTutorProfileMapByIdsMock(ids),
    getSessionDetail: async () => null,
    getTutorAssignedSessionRows: async () => [],
    getStudentRecentProgressRows: async () => [],
    now: () => '2026-03-21T12:00:00.000Z',
    notFound: () => {
      throw new Error('notFound');
    },
    redirect: path => {
      throw new Error(`redirect:${path}`);
    },
  };
}

describe('getSessions ordering', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('puts Scheduled sessions first and sorts both groups by latest date first', async () => {
    deps = createDeps();
    getSessionListRowsMock.mockResolvedValueOnce([
      {
        id: 1,
        tutorId: 10,
        studentId: 100,
        subjectId: 1000,
        parentId: 10000,
        slotUnits: 2,
        scheduledAt: '2026-03-01T10:00:00.000Z',
        endsAt: '2026-03-01T11:00:00.000Z',
        status: 'Completed',
        studentParentId: 10000,
        studentLearningGoals: null,
        studentFirstName: null,
        studentLastName: null,
        studentEmail: 'student1@example.com',
        parentBillingAddress: null,
        parentNotificationPreferences: null,
        parentFirstName: null,
        parentLastName: null,
        parentEmail: 'parent1@example.com',
      },
      {
        id: 2,
        tutorId: 20,
        studentId: 200,
        subjectId: 2000,
        parentId: 20000,
        slotUnits: 2,
        scheduledAt: '2026-03-02T10:00:00.000Z',
        endsAt: '2026-03-02T11:00:00.000Z',
        status: 'Scheduled',
        studentParentId: 20000,
        studentLearningGoals: null,
        studentFirstName: null,
        studentLastName: null,
        studentEmail: 'student2@example.com',
        parentBillingAddress: null,
        parentNotificationPreferences: null,
        parentFirstName: null,
        parentLastName: null,
        parentEmail: 'parent2@example.com',
      },
      {
        id: 3,
        tutorId: 30,
        studentId: 300,
        subjectId: 3000,
        parentId: 30000,
        slotUnits: 2,
        scheduledAt: '2026-03-04T10:00:00.000Z',
        endsAt: '2026-03-04T11:00:00.000Z',
        status: 'Pending-Notes',
        studentParentId: 30000,
        studentLearningGoals: null,
        studentFirstName: null,
        studentLastName: null,
        studentEmail: 'student3@example.com',
        parentBillingAddress: null,
        parentNotificationPreferences: null,
        parentFirstName: null,
        parentLastName: null,
        parentEmail: 'parent3@example.com',
      },
      {
        id: 4,
        tutorId: 40,
        studentId: 400,
        subjectId: 4000,
        parentId: 40000,
        slotUnits: 2,
        scheduledAt: '2026-03-03T10:00:00.000Z',
        endsAt: '2026-03-03T11:00:00.000Z',
        status: 'Scheduled',
        studentParentId: 40000,
        studentLearningGoals: null,
        studentFirstName: null,
        studentLastName: null,
        studentEmail: 'student4@example.com',
        parentBillingAddress: null,
        parentNotificationPreferences: null,
        parentFirstName: null,
        parentLastName: null,
        parentEmail: 'parent4@example.com',
      },
      {
        id: 5,
        tutorId: 50,
        studentId: 500,
        subjectId: 5000,
        parentId: 50000,
        slotUnits: 2,
        scheduledAt: '2026-03-05T10:00:00.000Z',
        endsAt: '2026-03-05T11:00:00.000Z',
        status: 'Rescheduled',
        studentParentId: 50000,
        studentLearningGoals: null,
        studentFirstName: null,
        studentLastName: null,
        studentEmail: 'student5@example.com',
        parentBillingAddress: null,
        parentNotificationPreferences: null,
        parentFirstName: null,
        parentLastName: null,
        parentEmail: 'parent5@example.com',
      },
    ]);
    getSubjectMapByIdsMock.mockResolvedValue(
      new Map([
        [1000, { name: 'Subject 1' }],
        [2000, { name: 'Subject 2' }],
        [3000, { name: 'Subject 3' }],
        [4000, { name: 'Subject 4' }],
        [5000, { name: 'Subject 5' }],
      ])
    );
    getTutorProfileMapByIdsMock.mockResolvedValue(
      new Map([
        [10, { name: 'Tutor 1', email: '', phone: '—' }],
        [20, { name: 'Tutor 2', email: '', phone: '—' }],
        [30, { name: 'Tutor 3', email: '', phone: '—' }],
        [40, { name: 'Tutor 4', email: '', phone: '—' }],
        [50, { name: 'Tutor 5', email: '', phone: '—' }],
      ])
    );

    const service = createSessionDataService(deps);
    const sessions = await service.getSessions();

    expect(sessions.map(session => session.id)).toEqual([4, 2, 5, 3, 1]);
  });
});
