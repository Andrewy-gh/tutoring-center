import { addGrade, getStudentsForGradeForm, getSubjectsForGradeForm } from '@/lib/data/grades';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NEXT_NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';

const { mockDbSelect, mockDbInsert, mockGetCurrentUserID, mockNotFound } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockGetCurrentUserID: vi.fn(),
  mockNotFound: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
}));

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
  forbidden: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
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

function createInsertQuery(result: unknown) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue(result),
    })),
  };
}

function createNextNotFoundError() {
  const error = new Error(NEXT_NOT_FOUND_DIGEST) as Error & { digest?: string };
  error.digest = NEXT_NOT_FOUND_DIGEST;
  return error;
}

describe('grade data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNotFound.mockImplementation(() => {
      throw createNextNotFoundError();
    });
  });

  it('writes grades with subject_id + leaf subject_kind', async () => {
    mockGetCurrentUserID.mockResolvedValue(42);
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 7 }]))
      .mockReturnValueOnce(createSelectQuery([{ id: 10, parent_id: 7 }]))
      .mockReturnValueOnce(createSelectQuery([{ id: 55, name: 'Fractions', kind: 'leaf' }]));
    mockDbInsert.mockReturnValueOnce(
      createInsertQuery([
        {
          id: 99,
          student_id: 10,
          subject_id: 55,
          subject_kind: 'leaf',
          grade: 'A',
          created_at: '2026-03-18T12:00:00.000Z',
        },
      ])
    );

    const result = await addGrade({ student_id: 10, subject_id: 55, grade: 93 });

    expect(result).toEqual({
      id: 99,
      student_id: 10,
      subject_id: 55,
      subject_kind: 'leaf',
      grade: 'A',
      created_at: '2026-03-18T12:00:00.000Z',
      subject: 'Fractions',
    });
  });

  it('rejects non-leaf subjects before inserting a grade', async () => {
    mockGetCurrentUserID.mockResolvedValue(42);
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 7 }]))
      .mockReturnValueOnce(createSelectQuery([{ id: 10, parent_id: 7 }]))
      .mockReturnValueOnce(createSelectQuery([]));
    mockDbInsert.mockReturnValueOnce(createInsertQuery([]));

    await expect(addGrade({ student_id: 10, subject_id: 12, grade: 88 })).rejects.toThrow(
      'Grade data is invalid. Please check your input.'
    );
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('preserves notFound when the current parent row is missing', async () => {
    mockGetCurrentUserID.mockResolvedValue(42);
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    await expect(getStudentsForGradeForm('parent')).rejects.toMatchObject({ digest: NEXT_NOT_FOUND_DIGEST });
  });

  it('returns only leaf subjects for the grade form', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        { id: 3, name: ' Algebra I ', slug: ' algebra-i ', kind: 'leaf', is_active: true },
        { id: 8, name: 'Geometry', slug: 'geometry', kind: 'leaf', is_active: true },
      ])
    );

    await expect(getSubjectsForGradeForm()).resolves.toEqual([
      { id: 3, slug: 'algebra-i', name: 'Algebra I' },
      { id: 8, slug: 'geometry', name: 'Geometry' },
    ]);
  });
});
