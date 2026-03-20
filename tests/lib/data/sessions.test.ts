import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { getSession, getSessions } from '@/lib/data/sessions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSubjectMapByIds, mockGetTutorProfileMapByIds, mockDbSelect, mockNotFound, mockRedirect } = vi.hoisted(
  () => ({
    mockGetSubjectMapByIds: vi.fn(),
    mockGetTutorProfileMapByIds: vi.fn(),
    mockDbSelect: vi.fn(),
    mockNotFound: vi.fn(),
    mockRedirect: vi.fn(),
  })
);

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: vi.fn(),
  getUserRole: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
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

describe('getSessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
    mockRedirect.mockImplementation(() => {
      throw new Error('redirect');
    });
    vi.mocked(getUserRole).mockResolvedValue('admin');
    vi.mocked(getCurrentUserID).mockResolvedValue(1);
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[1, { id: 1, name: 'Mathematics', slug: 'mathematics' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(
      new Map([[101, { id: 101, name: 'Jane Tutor', email: 'jane@example.com', phone: '555-1111' }]])
    );
  });

  it('returns mapped sessions for admin users', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
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
      ])
    );

    await expect(getSessions()).resolves.toEqual([
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
    vi.mocked(getUserRole).mockResolvedValue('parent');
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 77 }])).mockReturnValueOnce(createSelectQuery([]));

    await expect(getSessions()).resolves.toEqual([]);
  });
});

describe('getSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
    mockRedirect.mockImplementation(() => {
      throw new Error('redirect');
    });
    vi.mocked(getUserRole).mockResolvedValue('admin');
    vi.mocked(getCurrentUserID).mockResolvedValue(1);
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[1, { id: 1, name: 'Mathematics', slug: 'mathematics' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(
      new Map([[101, { id: 101, name: 'Jane Tutor', email: 'jane@example.com', phone: '555-1111' }]])
    );
  });

  it('returns session detail for a valid id', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        {
          id: 1,
          tutor_id: 101,
          scheduled_at: '2026-04-01T10:00:00Z',
          ends_at: '2026-04-01T11:00:00Z',
          slot_units: 2,
          status: 'Scheduled',
          subject_id: 1,
          parent_id: 1,
          student_id: 201,
          student_parent_id: 1,
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
        },
      ])
    );

    const session = await getSession(1);
    expect(session.id).toBe(1);
    expect(session.subject_name).toBe('Mathematics');
    expect(session.student.name).toBe('John Student');
  });

  it('throws notFound for invalid id', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    await expect(getSession(999)).rejects.toThrow('notFound');
  });
});
