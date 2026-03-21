import { createSessionProgressService, type SessionProgressServiceDeps } from '@/lib/actions/session-progress-service';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

let deps: SessionProgressServiceDeps;
let saveProgressReportMock: Mock<SessionProgressServiceDeps['saveProgressReport']>;
let getUserRoleMock: Mock<SessionProgressServiceDeps['getUserRole']>;
let getCurrentUserIDMock: Mock<SessionProgressServiceDeps['getCurrentUserID']>;
let getTutorIdByUserIdMock: Mock<SessionProgressServiceDeps['getTutorIdByUserId']>;
let getSessionTutorIdMock: Mock<SessionProgressServiceDeps['getSessionTutorId']>;

function createDeps(): SessionProgressServiceDeps {
  saveProgressReportMock = vi.fn<SessionProgressServiceDeps['saveProgressReport']>().mockResolvedValue(undefined);
  getUserRoleMock = vi.fn<SessionProgressServiceDeps['getUserRole']>().mockResolvedValue('tutor');
  getCurrentUserIDMock = vi.fn<SessionProgressServiceDeps['getCurrentUserID']>().mockResolvedValue(44);
  getTutorIdByUserIdMock = vi.fn<SessionProgressServiceDeps['getTutorIdByUserId']>().mockResolvedValue(9);
  getSessionTutorIdMock = vi.fn<SessionProgressServiceDeps['getSessionTutorId']>().mockResolvedValue(9);

  return {
    saveProgressReport: values => saveProgressReportMock(values),
    getUserRole: () => getUserRoleMock(),
    getCurrentUserID: () => getCurrentUserIDMock(),
    getTutorIdByUserId: userId => getTutorIdByUserIdMock(userId),
    getSessionTutorId: sessionId => getSessionTutorIdMock(sessionId),
    now: vi.fn(() => '2026-03-21T12:00:00.000Z'),
  };
}

describe('submitProgressReport', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('normalizes empty fields to null before saving', async () => {
    const service = createSessionProgressService(deps);

    await expect(
      service.submitProgressReport({
        sessionId: 22,
        topics: '',
        homeworkAssigned: 'Worksheet 3',
        publicNotes: '',
        internalNotes: 'Needs follow-up',
      })
    ).resolves.toEqual({ success: true });

    expect(saveProgressReportMock).toHaveBeenCalledWith({
      sessionId: 22,
      topics: null,
      homeworkAssigned: 'Worksheet 3',
      publicNotes: null,
      internalNotes: 'Needs follow-up',
      updatedAt: '2026-03-21T12:00:00.000Z',
    });
  });

  it('rejects tutors who are not assigned to the session', async () => {
    const service = createSessionProgressService({
      ...deps,
      getSessionTutorId: async () => 12,
      getTutorIdByUserId: async () => 9,
    });

    await expect(
      service.submitProgressReport({
        sessionId: 22,
        topics: 'Fractions',
        homeworkAssigned: '',
        publicNotes: '',
        internalNotes: '',
      })
    ).rejects.toThrow('You are not assigned to this session');

    expect(saveProgressReportMock).not.toHaveBeenCalled();
  });
});
