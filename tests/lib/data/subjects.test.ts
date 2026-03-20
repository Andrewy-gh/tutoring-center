import { getSubjectMapByIds, getSubjects, getSubjectsForGradeForm, mapSubjectOptions } from '@/lib/data/subjects';
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

describe('getSubjects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockIsUserRole.mockImplementation(value => value === 'admin' || value === 'parent' || value === 'tutor');
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('loads active leaf subjects through a joined Drizzle query', async () => {
    const query = createSelectQuery([
      {
        id: 2,
        name: 'Science',
        slug: 'science',
        kind: 'leaf',
        isActive: true,
        tutorId: 20,
        subjectId: 2,
      },
      {
        id: 1,
        name: 'Math',
        slug: 'math',
        kind: 'leaf',
        isActive: true,
        tutorId: 10,
        subjectId: 1,
      },
      {
        id: 1,
        name: 'Math',
        slug: 'math',
        kind: 'leaf',
        isActive: true,
        tutorId: 30,
        subjectId: 1,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getSubjects('admin')).resolves.toEqual([
      {
        slug: 'math',
        name: 'Math',
        tutorCount: 2,
        assignments: [
          { tutorId: 10, subjectId: 1, subjectSlug: 'math' },
          { tutorId: 30, subjectId: 1, subjectSlug: 'math' },
        ],
      },
      {
        slug: 'science',
        name: 'Science',
        tutorCount: 1,
        assignments: [{ tutorId: 20, subjectId: 2, subjectSlug: 'science' }],
      },
    ]);

    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('throws when role is invalid', async () => {
    mockIsUserRole.mockReturnValue(false);

    await expect(getSubjects('admin')).rejects.toThrow('Role is required to fetch students.');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('throws forbidden for tutors', async () => {
    await expect(getSubjects('tutor')).rejects.toThrow('forbidden');
    expect(mockForbidden).toHaveBeenCalledTimes(1);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('throws when the joined query fails', async () => {
    const query = createSelectQuery([]);
    query.then.mockImplementationOnce((_resolve, reject) =>
      Promise.reject(new Error('db failed')).then(undefined, reject)
    );
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getSubjects('admin')).rejects.toThrow(
      'Loading subject records for admin views failed due to a temporary backend issue. Please try again.'
    );
  });

  it('throws when joined subject rows fail validation', async () => {
    const query = createSelectQuery([
      {
        id: 'bad-id',
        name: 'Math',
        slug: 'math',
        kind: 'leaf',
        isActive: true,
        tutorId: 10,
        subjectId: 1,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getSubjects('admin')).rejects.toThrow('Subject data format is invalid. Please try again later.');
  });
});

describe('getSubjectMapByIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a subject map for distinct positive ids only', async () => {
    const query = createSelectQuery([
      { id: 2, name: 'Science', slug: 'science', kind: 'leaf', isActive: true },
      { id: 7, name: 'Math', slug: 'math', kind: 'group', isActive: false },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    const result = await getSubjectMapByIds([2, 7, 2, -1, 1.2]);

    expect(result).toEqual(
      new Map([
        [2, { id: 2, name: 'Science', slug: 'science', kind: 'leaf', is_active: true }],
        [7, { id: 7, name: 'Math', slug: 'math', kind: 'group', is_active: false }],
      ])
    );
    expect(query.where).toHaveBeenCalledTimes(1);
  });

  it('skips the database when there are no usable ids', async () => {
    await expect(getSubjectMapByIds([0, -4, 1.1])).resolves.toEqual(new Map());
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});

describe('getSubjectsForGradeForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns trimmed active leaf subjects ordered for the grade form', async () => {
    const query = createSelectQuery([
      { id: 3, name: ' Algebra I ', slug: ' algebra-i ', kind: 'leaf', isActive: true },
      { id: 8, name: 'Geometry', slug: 'geometry', kind: 'leaf', isActive: true },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getSubjectsForGradeForm()).resolves.toEqual([
      { id: 3, slug: 'algebra-i', name: 'Algebra I' },
      { id: 8, slug: 'geometry', name: 'Geometry' },
    ]);
    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('throws when the grade-form subject rows are invalid', async () => {
    const query = createSelectQuery([{ id: 3, name: 'Algebra I', slug: 'algebra-i', kind: 'group', isActive: true }]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getSubjectsForGradeForm()).rejects.toThrow(
      'There was a problem preparing subjects. Please try again.'
    );
  });
});

describe('mapSubjectOptions', () => {
  it('keeps the smallest subject id per tutor and returns slug-based assignments', () => {
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

  it('skips subjects that normalize to empty slug or name', () => {
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

  it('returns deterministic subject and tutor assignment sorting', () => {
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
