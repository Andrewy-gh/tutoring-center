import { createSessionStatusService, type SessionStatusServiceDeps } from '@/features/sessions/session-status-service';
import { describe, expect, it, vi } from 'vitest';

describe('updateSessionStatus', () => {
  it('delegates status updates to the sessions query boundary', async () => {
    const updatedSession = {
      id: 55,
      tutor_id: 11,
      student_id: 22,
      subject_id: 33,
      parent_id: 44,
      slot_units: 1,
      scheduled_at: '2026-03-02T15:00:00.000Z',
      ends_at: '2026-03-02T16:00:00.000Z',
      status: 'Completed' as const,
    };
    const updateSessionStatusById = vi
      .fn<SessionStatusServiceDeps['updateSessionStatusById']>()
      .mockResolvedValue(updatedSession);
    const service = createSessionStatusService({ updateSessionStatusById });

    await expect(service.updateSessionStatus({ id: 55, status: 'Completed' })).resolves.toEqual(updatedSession);
    expect(updateSessionStatusById).toHaveBeenCalledWith({ id: 55, status: 'Completed' });
  });

  it('returns null when the query finds no session', async () => {
    const updateSessionStatusById = vi
      .fn<SessionStatusServiceDeps['updateSessionStatusById']>()
      .mockResolvedValue(null);
    const service = createSessionStatusService({ updateSessionStatusById });

    await expect(service.updateSessionStatus({ id: 55, status: 'Completed' })).resolves.toBeNull();
  });
});
