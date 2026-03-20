import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIsUserRole, mockForbidden, mockDbSelect } = vi.hoisted(() => ({
  mockIsUserRole: vi.fn(),
  mockForbidden: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
}));

vi.mock('@/lib/auth', () => ({
  isUserRole: mockIsUserRole,
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
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createRejectingSelectQuery(message: string) {
  const query = createSelectQuery([]);
  query.then.mockImplementationOnce((_resolve, reject) => Promise.reject(new Error(message)).then(undefined, reject));
  return query;
}

describe('getSubjects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsUserRole.mockImplementation(value => value === 'admin' || value === 'parent' || value === 'tutor');
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('returns mapped subject options from database rows', async () => {
    const query = createSelectQuery([
      { id: 1, name: 'Math', slug: 'math', kind: 'leaf', is_active: true, tutor_id: 10, subject_id: 1 },
      { id: 2, name: 'Science', slug: 'science', kind: 'leaf', is_active: true, tutor_id: 20, subject_id: 2 },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    const { getSubjects } = await import('@/lib/data/subjects');
    await expect(getSubjects('admin')).resolves.toEqual([
      {
        slug: 'math',
        name: 'Math',
        tutorCount: 1,
        assignments: [{ tutorId: 10, subjectId: 1, subjectSlug: 'math' }],
      },
      {
        slug: 'science',
        name: 'Science',
        tutorCount: 1,
        assignments: [{ tutorId: 20, subjectId: 2, subjectSlug: 'science' }],
      },
    ]);

    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('throws when role is invalid', async () => {
    mockIsUserRole.mockReturnValue(false);

    const { getSubjects } = await import('@/lib/data/subjects');
    await expect(getSubjects('admin')).rejects.toThrow('Role is required to fetch students.');
  });

  it('throws forbidden for tutors', async () => {
    const { getSubjects } = await import('@/lib/data/subjects');
    await expect(getSubjects('tutor')).rejects.toThrow('forbidden');
    expect(mockForbidden).toHaveBeenCalledTimes(1);
  });

  it('throws when the database query fails', async () => {
    mockDbSelect.mockReturnValueOnce(createRejectingSelectQuery('db failed'));

    const { getSubjects } = await import('@/lib/data/subjects');
    await expect(getSubjects('admin')).rejects.toThrow(
      'Loading subject records for admin views failed due to a temporary backend issue. Please try again.'
    );
  });

  it('throws when subject rows fail validation', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        { id: 'bad-id', name: 'Math', slug: 'math', kind: 'leaf', is_active: true, tutor_id: 1, subject_id: 1 },
      ])
    );

    const { getSubjects } = await import('@/lib/data/subjects');
    await expect(getSubjects('admin')).rejects.toThrow('Subject data format is invalid. Please try again later.');
  });

  it('returns an empty array when there are no subjects', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    const { getSubjects } = await import('@/lib/data/subjects');
    await expect(getSubjects('admin')).resolves.toEqual([]);
  });
});

describe('mapSubjectOptions', () => {
  it('keeps the smallest subject id per tutor and returns slug-based assignments', async () => {
    const { mapSubjectOptions } = await import('@/lib/data/subjects');

    const result = mapSubjectOptions([
      {
        id: 5,
        name: 'Math',
        slug: 'math',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [
          { tutor_id: 10, subject_id: 5 },
          { tutor_id: 10, subject_id: 2 },
          { tutor_id: 20, subject_id: 3 },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        slug: 'math',
        name: 'Math',
        tutorCount: 2,
        assignments: [
          { tutorId: 10, subjectId: 2, subjectSlug: 'math' },
          { tutorId: 20, subjectId: 3, subjectSlug: 'math' },
        ],
      },
    ]);
  });

  it('skips subjects that normalize to empty slug or name', async () => {
    const { mapSubjectOptions } = await import('@/lib/data/subjects');

    const result = mapSubjectOptions([
      {
        id: 1,
        name: '   ',
        slug: 'math',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [{ tutor_id: 10, subject_id: 1 }],
      },
      {
        id: 2,
        name: 'Science',
        slug: '   ',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [{ tutor_id: 20, subject_id: 2 }],
      },
      {
        id: 3,
        name: 'History',
        slug: 'history',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [{ tutor_id: 30, subject_id: 3 }],
      },
    ]);

    expect(result).toEqual([
      {
        slug: 'history',
        name: 'History',
        tutorCount: 1,
        assignments: [{ tutorId: 30, subjectId: 3, subjectSlug: 'history' }],
      },
    ]);
  });

  it('returns deterministic subject and tutor assignment sorting', async () => {
    const { mapSubjectOptions } = await import('@/lib/data/subjects');

    const result = mapSubjectOptions([
      {
        id: 9,
        name: 'Science',
        slug: 'science',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [{ tutor_id: 20, subject_id: 9 }],
      },
      {
        id: 4,
        name: 'Math',
        slug: 'math',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [
          { tutor_id: 30, subject_id: 4 },
          { tutor_id: 10, subject_id: 4 },
        ],
      },
      {
        id: 2,
        name: 'History',
        slug: 'history',
        kind: 'leaf',
        is_active: true,
        tutor_subjects: [{ tutor_id: 40, subject_id: 2 }],
      },
    ]);

    expect(result).toEqual([
      {
        slug: 'history',
        name: 'History',
        tutorCount: 1,
        assignments: [{ tutorId: 40, subjectId: 2, subjectSlug: 'history' }],
      },
      {
        slug: 'math',
        name: 'Math',
        tutorCount: 2,
        assignments: [
          { tutorId: 10, subjectId: 4, subjectSlug: 'math' },
          { tutorId: 30, subjectId: 4, subjectSlug: 'math' },
        ],
      },
      {
        slug: 'science',
        name: 'Science',
        tutorCount: 1,
        assignments: [{ tutorId: 20, subjectId: 9, subjectSlug: 'science' }],
      },
    ]);
  });
});
