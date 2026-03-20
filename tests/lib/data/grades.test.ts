import { addGrade, getSubjectsForGradeForm } from '@/lib/data/grades';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockDbInsert, mockGetCurrentUserID, mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockGetCurrentUserID: vi.fn(),
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
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

describe('grade data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
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

  it('returns only leaf subjects for the grade form', async () => {
    const subjectsQuery = {
      eq: vi.fn(() => subjectsQuery),
      order: vi.fn(() => subjectsQuery),
      then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
        Promise.resolve({
          data: [
            { id: 3, name: ' Algebra I ', slug: ' algebra-i ', kind: 'leaf', is_active: true },
            { id: 8, name: 'Geometry', slug: 'geometry', kind: 'leaf', is_active: true },
          ],
          error: null,
        }).then(resolve, reject)
      ),
    };

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'subjects') return { select: vi.fn(() => subjectsQuery) };
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getSubjectsForGradeForm()).resolves.toEqual([
      { id: 3, slug: 'algebra-i', name: 'Algebra I' },
      { id: 8, slug: 'geometry', name: 'Geometry' },
    ]);
    expect(subjectsQuery.eq).toHaveBeenCalledWith('kind', 'leaf');
    expect(subjectsQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(subjectsQuery.order).toHaveBeenCalledWith('name');
    expect(subjectsQuery.order).toHaveBeenCalledWith('slug');
  });
});
