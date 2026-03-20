import { submitSessionMetrics } from '@/lib/actions/session-metrics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUserID, mockGetUserRole, mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockGetCurrentUserID: vi.fn(),
  mockGetUserRole: vi.fn(),
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
  getUserRole: mockGetUserRole,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

function createSessionQuery(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
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
    const sessionsQuery = createSessionQuery({ data: { tutor_id: 9 }, error: null });
    const tutorsQuery = createSessionQuery({ data: { id: 9 }, error: null });
    const metricsSelectQuery = createSessionQuery({ data: null, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });

    mockCreateSupabaseServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'sessions') return { select: vi.fn(() => sessionsQuery) };
        if (table === 'tutors') return { select: vi.fn(() => tutorsQuery) };
        if (table === 'session_metrics') {
          return {
            select: vi.fn(() => metricsSelectQuery),
            insert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
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

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 17,
        confidence_score: 4,
        session_performance: 5,
        homework_completed: true,
        tutor_comments: 'Strong follow-through.',
      })
    );
    expect(insert).toHaveBeenCalledWith(expect.not.objectContaining({ student_id: expect.anything() }));
  });
});
