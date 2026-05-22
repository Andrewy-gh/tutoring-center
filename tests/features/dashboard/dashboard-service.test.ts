import { getStudentGrades, getStudentsWithProgress } from '@/features/dashboard/dashboard-service';
import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockGetSubjectMapByIds } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockGetSubjectMapByIds: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: vi.fn(),
  getUserRole: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

vi.mock('@/features/subjects/subjects-service', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
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

function createRejectingSelectQuery(message: string) {
  const query = createSelectQuery([]);
  query.then.mockImplementationOnce((_resolve, reject) => Promise.reject(new Error(message)).then(undefined, reject));
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

describe('getStudentsWithProgress', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserRole).mockResolvedValue('parent');
    vi.mocked(getCurrentUserID).mockResolvedValue(42);
  });

  it('keeps the student list and falls back to empty series when metrics loading fails', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 55 }]))
      .mockReturnValueOnce(
        createSelectQuery([
          { id: 10, firstName: 'Jane', lastName: 'Doe' },
          { id: 11, firstName: 'John', lastName: 'Doe' },
        ])
      )
      .mockReturnValueOnce(createRejectingSelectQuery('metrics failed'));

    await expect(getStudentsWithProgress()).resolves.toEqual([
      {
        studentId: 10,
        studentName: 'Jane Doe',
        performance: [],
        confidence: [],
        homework: [],
      },
      {
        studentId: 11,
        studentName: 'John Doe',
        performance: [],
        confidence: [],
        homework: [],
      },
    ]);
  });
});
