import { getStudentGrades } from '@/lib/data/dashboard';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockGetSubjectMapByIds } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockGetSubjectMapByIds: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('@/lib/data/subjects', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
}));

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('getStudentGrades', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves subject names from subject ids in the redesigned grade schema', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        { id: 1, subject_id: 12, grade: 'A-', created_at: '2026-03-01T12:00:00.000Z' },
        { id: 2, subject_id: 19, grade: 'B+', created_at: '2026-03-10T12:00:00.000Z' },
      ])
    );
    mockGetSubjectMapByIds.mockResolvedValue(
      new Map([
        [12, { id: 12, name: 'Algebra II', slug: 'algebra-ii' }],
        [19, { id: 19, name: 'Biology', slug: 'biology' }],
      ])
    );

    await expect(getStudentGrades(77)).resolves.toEqual([
      {
        id: 1,
        subject: 'Algebra II',
        subjectSlug: 'algebra-ii',
        grade: 'A-',
        createdAt: '2026-03-01T12:00:00.000Z',
      },
      {
        id: 2,
        subject: 'Biology',
        subjectSlug: 'biology',
        grade: 'B+',
        createdAt: '2026-03-10T12:00:00.000Z',
      },
    ]);
    expect(mockGetSubjectMapByIds).toHaveBeenCalledWith([12, 19]);
  });
});
