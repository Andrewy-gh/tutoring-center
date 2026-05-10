import { createSessionDataService, type SessionDataServiceDeps } from '@/features/sessions/sessions-service';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

let deps: SessionDataServiceDeps;
let getSessionListRowsMock: Mock<SessionDataServiceDeps['getSessionListRows']>;
let getSubjectMapByIdsMock: Mock<SessionDataServiceDeps['getSubjectMapByIds']>;
let getTutorProfileMapByIdsMock: Mock<SessionDataServiceDeps['getTutorProfileMapByIds']>;

function createDeps() {
  getSessionListRowsMock = vi.fn<SessionDataServiceDeps['getSessionListRows']>().mockResolvedValue([]);
  getSubjectMapByIdsMock = vi.fn<SessionDataServiceDeps['getSubjectMapByIds']>().mockResolvedValue(new Map());
  getTutorProfileMapByIdsMock = vi.fn<SessionDataServiceDeps['getTutorProfileMapByIds']>().mockResolvedValue(new Map());

  const nextDeps: SessionDataServiceDeps = {
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

  return nextDeps;
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
        tutor_id: 10,
        student_id: 100,
        subject_id: 1000,
        parent_id: 10000,
        slot_units: 2,
        scheduled_at: '2026-03-01T10:00:00.000Z',
        ends_at: '2026-03-01T11:00:00.000Z',
        status: 'Completed',
        student_parent_id: 10000,
        student_learning_goals: null,
        student_first_name: null,
        student_last_name: null,
        student_email: 'student1@example.com',
        parent_billing_address: null,
        parent_notification_preferences: null,
        parent_first_name: null,
        parent_last_name: null,
        parent_email: 'parent1@example.com',
      },
      {
        id: 2,
        tutor_id: 20,
        student_id: 200,
        subject_id: 2000,
        parent_id: 20000,
        slot_units: 2,
        scheduled_at: '2026-03-02T10:00:00.000Z',
        ends_at: '2026-03-02T11:00:00.000Z',
        status: 'Scheduled',
        student_parent_id: 20000,
        student_learning_goals: null,
        student_first_name: null,
        student_last_name: null,
        student_email: 'student2@example.com',
        parent_billing_address: null,
        parent_notification_preferences: null,
        parent_first_name: null,
        parent_last_name: null,
        parent_email: 'parent2@example.com',
      },
      {
        id: 3,
        tutor_id: 30,
        student_id: 300,
        subject_id: 3000,
        parent_id: 30000,
        slot_units: 2,
        scheduled_at: '2026-03-04T10:00:00.000Z',
        ends_at: '2026-03-04T11:00:00.000Z',
        status: 'Pending-Notes',
        student_parent_id: 30000,
        student_learning_goals: null,
        student_first_name: null,
        student_last_name: null,
        student_email: 'student3@example.com',
        parent_billing_address: null,
        parent_notification_preferences: null,
        parent_first_name: null,
        parent_last_name: null,
        parent_email: 'parent3@example.com',
      },
      {
        id: 4,
        tutor_id: 40,
        student_id: 400,
        subject_id: 4000,
        parent_id: 40000,
        slot_units: 2,
        scheduled_at: '2026-03-03T10:00:00.000Z',
        ends_at: '2026-03-03T11:00:00.000Z',
        status: 'Scheduled',
        student_parent_id: 40000,
        student_learning_goals: null,
        student_first_name: null,
        student_last_name: null,
        student_email: 'student4@example.com',
        parent_billing_address: null,
        parent_notification_preferences: null,
        parent_first_name: null,
        parent_last_name: null,
        parent_email: 'parent4@example.com',
      },
      {
        id: 5,
        tutor_id: 50,
        student_id: 500,
        subject_id: 5000,
        parent_id: 50000,
        slot_units: 2,
        scheduled_at: '2026-03-05T10:00:00.000Z',
        ends_at: '2026-03-05T11:00:00.000Z',
        status: 'Rescheduled',
        student_parent_id: 50000,
        student_learning_goals: null,
        student_first_name: null,
        student_last_name: null,
        student_email: 'student5@example.com',
        parent_billing_address: null,
        parent_notification_preferences: null,
        parent_first_name: null,
        parent_last_name: null,
        parent_email: 'parent5@example.com',
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
