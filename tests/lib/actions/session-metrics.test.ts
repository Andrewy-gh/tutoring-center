import { submitSessionMetrics } from '@/lib/actions/session-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbInsert, mockDbSelect, mockGetCurrentUserID, mockGetUserRole } = vi.hoisted(() => ({
  mockDbInsert: vi.fn(),
  mockDbSelect: vi.fn(),
  mockGetCurrentUserID: vi.fn(),
  mockGetUserRole: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
  getUserRole: mockGetUserRole,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    insert: mockDbInsert,
    select: mockDbSelect,
  },
}));

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(result),
  };

  return query;
}

describe('submitSessionMetrics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUserRole.mockResolvedValue('tutor');
    mockGetCurrentUserID.mockResolvedValue(44);
  });

  it('inserts metrics without the removed student_id column', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onConflictDoUpdate }));

    mockDbSelect.mockImplementationOnce(() => createSelectQuery([{ tutorId: 9 }]));
    mockDbSelect.mockImplementationOnce(() => createSelectQuery([{ id: 9 }]));
    mockDbInsert.mockReturnValue({
      values,
    });

    await expect(
      submitSessionMetrics({
        sessionId: 17,
        confidenceScore: 4,
        sessionPerformance: 5,
        homeworkCompleted: true,
        tutorComments: 'Strong follow-through.',
      })
    ).resolves.toEqual({ success: true });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 17,
        confidenceScore: 4,
        sessionPerformance: 5,
        homeworkCompleted: true,
        tutorComments: 'Strong follow-through.',
      })
    );
    expect(values).toHaveBeenCalledWith(expect.not.objectContaining({ studentId: expect.anything() }));
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.not.objectContaining({ studentId: expect.anything() }),
      })
    );
  });
});
