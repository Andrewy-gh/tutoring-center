import { getSubjects, mapSubjectOptions } from '@/lib/data/subjects';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockIsUserRole, mockForbidden, mockFrom, mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockIsUserRole: vi.fn(),
  mockForbidden: vi.fn(),
  mockFrom: vi.fn(),
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
}));

vi.mock('@/lib/auth', () => ({
  isUserRole: mockIsUserRole,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

const createMockQuery = (result: { data: unknown; error: unknown }) => {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn((resolve: (value: { data: unknown; error: unknown }) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  } as const;

  return query;
};

const setupSupabaseMock = (subjects: ReturnType<typeof createMockQuery>) => {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'subjects') return subjects;
    throw new Error(`Unexpected table ${table}`);
  });
  mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom } as const);
};

describe('getSubjects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFrom.mockReturnValue(undefined);
    mockIsUserRole.mockImplementation(value => value === 'admin' || value === 'parent' || value === 'tutor');
    mockCreateSupabaseServiceClient.mockReturnValue({ from: mockFrom });
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('applies expected query filters before loading subjects', async () => {
    const subjectsQuery = createMockQuery({
      data: [
        {
          id: 1,
          name: 'Math',
          slug: 'math',
          kind: 'leaf',
          is_active: true,
          tutor_subjects: [{ tutor_id: 10, subject_id: 1 }],
        },
        {
          id: 2,
          name: 'Science',
          slug: 'science',
          kind: 'leaf',
          is_active: true,
          tutor_subjects: [{ tutor_id: 20, subject_id: 2 }],
        },
      ],
      error: null,
    });
    setupSupabaseMock(subjectsQuery);

    await getSubjects('admin');

    expect(mockFrom).toHaveBeenCalledWith('subjects');
    expect(subjectsQuery.eq).toHaveBeenNthCalledWith(1, 'kind', 'leaf');
    expect(subjectsQuery.eq).toHaveBeenNthCalledWith(2, 'is_active', true);
  });

  it('throws when role is invalid', async () => {
    mockIsUserRole.mockReturnValue(false);

    await expect(getSubjects('admin')).rejects.toThrow('Role is required to fetch students.');
  });

  it('throws forbidden for tutors', async () => {
    await expect(getSubjects('tutor')).rejects.toThrow('forbidden');
    expect(mockForbidden).toHaveBeenCalledTimes(1);
  });

  it('throws when the database query fails', async () => {
    const subjectsQuery = createMockQuery({
      data: null,
      error: { message: 'db failed' },
    });
    setupSupabaseMock(subjectsQuery);

    await expect(getSubjects('admin')).rejects.toThrow();
  });

  it('throws when subject rows fail validation', async () => {
    const subjectsQuery = createMockQuery({
      data: [{ id: 'bad-id', name: 'Math', slug: 'math', kind: 'leaf', is_active: true, tutor_subjects: [] }],
      error: null,
    });
    setupSupabaseMock(subjectsQuery);

    await expect(getSubjects('admin')).rejects.toThrow();
  });

  it('returns an empty array when there are no subjects', async () => {
    const subjectsQuery = createMockQuery({ data: [], error: null });
    setupSupabaseMock(subjectsQuery);

    const result = await getSubjects('admin');

    expect(result).toEqual([]);
    expect(subjectsQuery.order).toHaveBeenCalledTimes(2);
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
