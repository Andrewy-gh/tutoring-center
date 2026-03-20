import { getStudentGrades } from '@/lib/data/dashboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

describe('getStudentGrades', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves subject names from subject ids in the redesigned grade schema', async () => {
    const gradesQuery = {
      eq: vi.fn(() => gradesQuery),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 1, subject_id: 12, grade: 'A-', created_at: '2026-03-01T12:00:00.000Z' },
          { id: 2, subject_id: 19, grade: 'B+', created_at: '2026-03-10T12:00:00.000Z' },
        ],
        error: null,
      }),
    };
    const subjectsQuery = {
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 12, name: 'Algebra II' },
          { id: 19, name: 'Biology' },
        ],
        error: null,
      }),
    };

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'student_grades') return { select: vi.fn(() => gradesQuery) };
        if (table === 'subjects') return { select: vi.fn(() => subjectsQuery) };
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await expect(getStudentGrades(77)).resolves.toEqual([
      { id: 1, subject: 'Algebra II', grade: 'A-', createdAt: '2026-03-01T12:00:00.000Z' },
      { id: 2, subject: 'Biology', grade: 'B+', createdAt: '2026-03-10T12:00:00.000Z' },
    ]);
    expect(subjectsQuery.in).toHaveBeenCalledWith('id', [12, 19]);
  });
});
