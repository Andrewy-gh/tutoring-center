import { createSessionMetricsService, type SessionMetricsServiceDeps } from '@/lib/actions/session-metrics-service';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

let deps: SessionMetricsServiceDeps;
let saveSessionMetricsMock: Mock<SessionMetricsServiceDeps['saveSessionMetrics']>;
let getUserRoleMock: Mock<SessionMetricsServiceDeps['getUserRole']>;
let getCurrentUserIDMock: Mock<SessionMetricsServiceDeps['getCurrentUserID']>;
let getTutorIdByUserIdMock: Mock<SessionMetricsServiceDeps['getTutorIdByUserId']>;
let getSessionTutorIdMock: Mock<SessionMetricsServiceDeps['getSessionTutorId']>;

function createDeps(): SessionMetricsServiceDeps {
  saveSessionMetricsMock = vi.fn<SessionMetricsServiceDeps['saveSessionMetrics']>().mockResolvedValue(undefined);
  getUserRoleMock = vi.fn<SessionMetricsServiceDeps['getUserRole']>().mockResolvedValue('tutor');
  getCurrentUserIDMock = vi.fn<SessionMetricsServiceDeps['getCurrentUserID']>().mockResolvedValue(44);
  getTutorIdByUserIdMock = vi.fn<SessionMetricsServiceDeps['getTutorIdByUserId']>().mockResolvedValue(9);
  getSessionTutorIdMock = vi.fn<SessionMetricsServiceDeps['getSessionTutorId']>().mockResolvedValue(9);

  return {
    saveSessionMetrics: values => saveSessionMetricsMock(values),
    getUserRole: () => getUserRoleMock(),
    getCurrentUserID: () => getCurrentUserIDMock(),
    getTutorIdByUserId: userId => getTutorIdByUserIdMock(userId),
    getSessionTutorId: sessionId => getSessionTutorIdMock(sessionId),
    now: vi.fn(() => '2026-03-21T12:00:00.000Z'),
  };
}

describe('submitSessionMetrics', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('inserts metrics without the removed student_id column', async () => {
    const service = createSessionMetricsService(deps);

    await expect(
      service.submitSessionMetrics({
        sessionId: 17,
        confidenceScore: 4,
        sessionPerformance: 5,
        homeworkCompleted: true,
        tutorComments: 'Strong follow-through.',
      })
    ).resolves.toEqual({ success: true });

    expect(saveSessionMetricsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 17,
        confidenceScore: 4,
        sessionPerformance: 5,
        homeworkCompleted: true,
        tutorComments: 'Strong follow-through.',
      })
    );
    expect(saveSessionMetricsMock).toHaveBeenCalledWith(expect.not.objectContaining({ studentId: expect.anything() }));
  });

  it('rejects non-tutor users before touching persistence', async () => {
    const service = createSessionMetricsService({
      ...deps,
      getUserRole: async () => 'admin',
    });

    await expect(
      service.submitSessionMetrics({
        sessionId: 17,
        confidenceScore: 4,
        sessionPerformance: 5,
        homeworkCompleted: true,
        tutorComments: '',
      })
    ).rejects.toThrow('Only tutors can submit session metrics');

    expect(saveSessionMetricsMock).not.toHaveBeenCalled();
    expect(getSessionTutorIdMock).not.toHaveBeenCalled();
  });
});
