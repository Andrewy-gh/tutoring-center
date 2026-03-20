import { submitSessionMetrics } from '@/lib/actions/session-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUserID, mockGetUserRole, mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
  getUserRole: mockGetUserRole,
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
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('submitSessionMetrics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUserRole.mockResolvedValue('tutor');
    mockGetCurrentUserID.mockResolvedValue(44);
  });

  it('inserts metrics without the removed studentId column', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ tutorId: 9 }]))
      .mockReturnValueOnce(createSelectQuery([{ id: 9 }]));

    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({
      onConflictDoUpdate,
    }));

    mockDbInsert.mockReturnValue({ values });

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
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });
});
