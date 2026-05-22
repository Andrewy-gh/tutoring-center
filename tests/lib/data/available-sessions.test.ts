import {
  AVAILABLE_SLOTS_ERROR_MESSAGES,
  createAvailableSessionsService,
  getAvailableSlots,
} from '@/lib/data/available-sessions';
import { describe, expect, it } from 'vitest';

describe('available sessions compatibility wrapper', () => {
  it('re-exports the booking-owned available sessions API', () => {
    expect(typeof getAvailableSlots).toBe('function');
    expect(typeof createAvailableSessionsService).toBe('function');
    expect(AVAILABLE_SLOTS_ERROR_MESSAGES.tutorSubject).toBe('Tutor does not teach this subject');
  });
});
