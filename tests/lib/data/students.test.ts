import type { UserRole } from '@/lib/auth';
import { getStudent, getStudents } from '@/lib/data/students';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetCurrentUserID,
  mockForbidden,
  mockNotFound,
  mockGetSubjectMapByIds,
  mockGetTutorProfileMapByIds,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockForbidden: vi.fn(),
  mockNotFound: vi.fn(),
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
  notFound: mockNotFound,
}));

vi.mock('@/lib/auth', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  getCurrentUserID: mockGetCurrentUserID,
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
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('getStudents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
    mockGetSubjectMapByIds.mockResolvedValue(new Map());
    mockGetTutorProfileMapByIds.mockResolvedValue(new Map());
  });

  it('maps admin rows with name + fallback grade', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        {
          id: 1,
          userId: 10,
          parentId: 100,
          birthDate: '2010-01-01',
          grade: null,
          learningGoals: 'Math',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@x.com',
          phone: null,
        },
      ])
    );

    const result = await getStudents('admin');

    expect(result).toEqual([
      {
        id: 1,
        user_id: 10,
        name: 'Jane Doe',
        email: 'jane@x.com',
        phone: '—',
        grade: '—',
      },
    ]);
  });

  it('throws a clear error when role is missing at runtime', async () => {
    await expect(getStudents(undefined as unknown as UserRole)).rejects.toThrow('Role is required to fetch students.');
  });

  it('throws notFound when parent lookup fails', async () => {
    mockGetCurrentUserID.mockResolvedValue(12);
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    await expect(getStudents('parent')).rejects.toThrow('notFound');
  });

  it('throws forbidden for tutors', async () => {
    await expect(getStudents('tutor')).rejects.toThrow('forbidden');
  });

  it('throws a role-specific database message for parent role', async () => {
    mockGetCurrentUserID.mockResolvedValue(20);

    const failingQuery = createSelectQuery([]);
    failingQuery.then.mockImplementationOnce((_resolve, reject) =>
      Promise.reject(new Error('db failed')).then(undefined, reject)
    );

    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 55 }])).mockReturnValueOnce(failingQuery);

    await expect(getStudents('parent')).rejects.toThrow(
      'Your student list is temporarily unavailable. Please try again in a moment.'
    );
  });

  it('throws a role-specific validation message for admin', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        {
          id: 'bad-id',
          userId: 10,
          parentId: 100,
          birthDate: null,
          grade: null,
          learningGoals: null,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@x.com',
          phone: null,
        },
      ])
    );

    await expect(getStudents('admin')).rejects.toThrow('Student data format is invalid. Please try again later.');
  });
});

describe('getStudent', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
    mockGetSubjectMapByIds.mockResolvedValue(new Map([[7, { id: 7, name: 'Algebra', slug: 'algebra' }]]));
    mockGetTutorProfileMapByIds.mockResolvedValue(new Map([[11, { id: 11, name: 'Alan Turing' }]]));
  });

  it('maps profile + recent sessions', async () => {
    mockDbSelect
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 1,
            userId: 10,
            parentId: 100,
            birthDate: '2010-01-01',
            grade: '8',
            learningGoals: 'Math mastery',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@x.com',
            phone: null,
          },
        ])
      )
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 50,
            subject_id: 7,
            tutor_id: 11,
            scheduled_at: '2026-03-01T15:00:00.000Z',
            ends_at: '2026-03-01T16:00:00.000Z',
            status: 'Completed',
            slot_units: 1,
          },
        ])
      );

    const result = await getStudent(1, 'admin');

    expect(result).toEqual({
      id: 1,
      user_id: 10,
      parent_id: 100,
      name: 'Jane Doe',
      email: 'jane@x.com',
      phone: '—',
      grade: '8',
      birth_date: '2010-01-01',
      learning_goals: 'Math mastery',
      sessions: [
        {
          id: 50,
          scheduled_at: '2026-03-01T15:00:00.000Z',
          ends_at: '2026-03-01T16:00:00.000Z',
          status: 'Completed',
          slot_units: 1,
          subject_name: 'Algebra',
          tutor_name: 'Alan Turing',
        },
      ],
    });
  });

  it('scopes parent role to the current family', async () => {
    mockGetCurrentUserID.mockResolvedValue(99);
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 55 }]))
      .mockReturnValueOnce(
        createSelectQuery([
          {
            id: 1,
            userId: 10,
            parentId: 55,
            birthDate: null,
            grade: null,
            learningGoals: null,
            firstName: 'Parent',
            lastName: 'Child',
            email: 'pc@example.com',
            phone: null,
          },
        ])
      )
      .mockReturnValueOnce(createSelectQuery([]));

    await expect(getStudent(1, 'parent')).resolves.toMatchObject({ parent_id: 55 });
  });

  it('throws notFound when a parent requests a missing student', async () => {
    mockGetCurrentUserID.mockResolvedValue(99);
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 55 }])).mockReturnValueOnce(createSelectQuery([]));

    await expect(getStudent(999, 'parent')).rejects.toThrow('notFound');
  });

  it('throws role-specific db message when the joined student query errors', async () => {
    const failingQuery = createSelectQuery([]);
    failingQuery.then.mockImplementationOnce((_resolve, reject) =>
      Promise.reject(new Error('db failed')).then(undefined, reject)
    );
    mockDbSelect.mockReturnValueOnce(failingQuery);

    await expect(getStudent(1, 'admin')).rejects.toThrow(
      'Student data is temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws forbidden for tutor role', async () => {
    await expect(getStudent(1, 'tutor')).rejects.toThrow('forbidden');
  });
});
