import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGetSubjectMapByIds, mockGetTutorProfileMapByIds, mockDbSelect } = vi.hoisted(() => ({
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: vi.fn(),
  getUserRole: vi.fn(async () => 'admin'),
}));

vi.mock('@/lib/data/subjects', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
}));

vi.mock('@/lib/data/tutors', () => ({
  getTutorProfileMapByIds: mockGetTutorProfileMapByIds,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('getSessions ordering', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('puts Scheduled sessions first and sorts both groups by latest date first', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
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
      ])
    );
    mockGetSubjectMapByIds.mockResolvedValue(
      new Map([
        [1000, { id: 1000, name: 'Subject 1', slug: 'subject-1' }],
        [2000, { id: 2000, name: 'Subject 2', slug: 'subject-2' }],
        [3000, { id: 3000, name: 'Subject 3', slug: 'subject-3' }],
        [4000, { id: 4000, name: 'Subject 4', slug: 'subject-4' }],
        [5000, { id: 5000, name: 'Subject 5', slug: 'subject-5' }],
      ])
    );
    mockGetTutorProfileMapByIds.mockResolvedValue(
      new Map([
        [10, { id: 10, name: 'Tutor 1', email: '', phone: '—' }],
        [20, { id: 20, name: 'Tutor 2', email: '', phone: '—' }],
        [30, { id: 30, name: 'Tutor 3', email: '', phone: '—' }],
        [40, { id: 40, name: 'Tutor 4', email: '', phone: '—' }],
        [50, { id: 50, name: 'Tutor 5', email: '', phone: '—' }],
      ])
    );

    const { getSessions } = await import('@/lib/data/sessions');
    const sessions = await getSessions();

    expect(sessions.map(session => session.id)).toEqual([4, 2, 5, 3, 1]);
  });
});
