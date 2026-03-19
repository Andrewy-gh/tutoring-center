import { addGrade } from '@/lib/data/grades';
import { getSubjectsForGradeForm } from '@/lib/data/subjects';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUserID, mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

type QueryResult = {
  data: unknown;
  error: unknown;
};

function createSingleResultQuery(result: QueryResult) {
  const query = {
    eq: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
    order: vi.fn(() => query),
    in: vi.fn(() => query),
  };

  return query;
}

function createInsertQuery(result: QueryResult) {
  const selection = {
    single: vi.fn().mockResolvedValue(result),
  };

  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => selection),
    })),
    selection,
  };
}

describe('grade data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('writes grades with subject_id + leaf subject_kind', async () => {
    mockGetCurrentUserID.mockResolvedValue(42);

    const parentsQuery = createSingleResultQuery({ data: { id: 7 }, error: null });
    const studentsQuery = createSingleResultQuery({ data: { id: 10, parent_id: 7 }, error: null });
    const subjectsQuery = createSingleResultQuery({ data: { id: 55, name: 'Fractions', kind: 'leaf' }, error: null });
    const gradesTable = createInsertQuery({
      data: {
        id: 99,
        student_id: 10,
        subject_id: 55,
        subject_kind: 'leaf',
        grade: 'A',
        created_at: '2026-03-18T12:00:00.000Z',
      },
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === 'parents') return { select: vi.fn(() => parentsQuery) };
      if (table === 'students') return { select: vi.fn(() => studentsQuery) };
      if (table === 'subjects') return { select: vi.fn(() => subjectsQuery) };
      if (table === 'student_grades') return gradesTable;
      throw new Error(`Unexpected table ${table}`);
    });

    mockCreateSupabaseServiceClient.mockReturnValue({ from });

    const result = await addGrade({ student_id: 10, subject_id: 55, grade: 93 });

    expect(subjectsQuery.eq).toHaveBeenNthCalledWith(1, 'id', 55);
    expect(subjectsQuery.eq).toHaveBeenNthCalledWith(2, 'kind', 'leaf');
    expect(gradesTable.insert).toHaveBeenCalledWith({
      student_id: 10,
      subject_id: 55,
      subject_kind: 'leaf',
      grade: 'A',
    });
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

    const parentsQuery = createSingleResultQuery({ data: { id: 7 }, error: null });
    const studentsQuery = createSingleResultQuery({ data: { id: 10, parent_id: 7 }, error: null });
    const subjectsQuery = createSingleResultQuery({ data: null, error: null });
    const gradesTable = createInsertQuery({ data: null, error: null });

    const from = vi.fn((table: string) => {
      if (table === 'parents') return { select: vi.fn(() => parentsQuery) };
      if (table === 'students') return { select: vi.fn(() => studentsQuery) };
      if (table === 'subjects') return { select: vi.fn(() => subjectsQuery) };
      if (table === 'student_grades') return gradesTable;
      throw new Error(`Unexpected table ${table}`);
    });

    mockCreateSupabaseServiceClient.mockReturnValue({ from });

    await expect(addGrade({ student_id: 10, subject_id: 12, grade: 88 })).rejects.toThrow(
      'Grade data is invalid. Please check your input.'
    );
    expect(gradesTable.insert).not.toHaveBeenCalled();
  });

  it('returns only leaf subjects for the grade form', async () => {
    const subjectsQuery = {
      eq: vi.fn(() => subjectsQuery),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 3, name: 'Algebra I', kind: 'leaf' },
          { id: 8, name: 'Geometry', kind: 'leaf' },
        ],
        error: null,
      }),
    };

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'subjects') return { select: vi.fn(() => subjectsQuery) };
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getSubjectsForGradeForm()).resolves.toEqual([
      { id: 3, category: 'Algebra I' },
      { id: 8, category: 'Geometry' },
    ]);
    expect(subjectsQuery.eq).toHaveBeenCalledWith('kind', 'leaf');
    expect(subjectsQuery.order).toHaveBeenCalledWith('name');
  });
});
