import { getParentIdByUserId } from '@/db/queries/actors';
import {
  getCompletedSessionMetricRows,
  getParentDashboardStudentRows,
  getStudentGradeRows,
} from '@/db/queries/parent-dashboard';
import { getStudentGrades, getStudentsWithProgress } from '@/features/parent-dashboard/parent-dashboard-service';
import { getSubjectMapByIds } from '@/features/subjects/subjects-service';
import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: vi.fn(),
  getUserRole: vi.fn(),
}));

vi.mock('@/db/queries/actors', () => ({
  getParentIdByUserId: vi.fn(),
}));

vi.mock('@/db/queries/parent-dashboard', () => ({
  getActiveLeafSubjectNameRows: vi.fn(),
  getCompletedSessionMetricRows: vi.fn(),
  getParentDashboardStudentRows: vi.fn(),
  getStudentGradeRows: vi.fn(),
}));

vi.mock('@/features/subjects/subjects-service', () => ({
  getSubjectMapByIds: vi.fn(),
}));

describe('getStudentGrades', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolves subject names from subject ids in the redesigned grade schema', async () => {
    vi.mocked(getStudentGradeRows).mockResolvedValue([
      { id: 1, subject_id: 12, grade: 'A-', created_at: '2026-03-01T12:00:00.000Z' },
      { id: 2, subject_id: 19, grade: 'B+', created_at: '2026-03-10T12:00:00.000Z' },
    ]);
    vi.mocked(getSubjectMapByIds).mockResolvedValue(
      new Map([
        [12, { id: 12, name: 'Algebra II', slug: 'algebra-ii', kind: 'leaf', is_active: true }],
        [19, { id: 19, name: 'Biology', slug: 'biology', kind: 'leaf', is_active: true }],
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
    expect(getSubjectMapByIds).toHaveBeenCalledWith([12, 19]);
  });
});

describe('getStudentsWithProgress', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getUserRole).mockResolvedValue('parent');
    vi.mocked(getCurrentUserID).mockResolvedValue(42);
    vi.mocked(getParentIdByUserId).mockResolvedValue(55);
  });

  it('keeps the student list and falls back to empty series when metrics loading fails', async () => {
    vi.mocked(getParentDashboardStudentRows).mockResolvedValue([
      { id: 10, firstName: 'Jane', lastName: 'Doe' },
      { id: 11, firstName: 'John', lastName: 'Doe' },
    ]);
    vi.mocked(getCompletedSessionMetricRows).mockRejectedValue(new Error('metrics failed'));

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
