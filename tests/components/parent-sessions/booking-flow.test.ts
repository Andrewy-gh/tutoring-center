import {
  getSessionSlotUnits,
  selectTutorsForSubject,
  shouldBlockForCredits,
  shouldStartAtSubjectStep,
} from '@/components/parent-sessions/booking-flow';
import { describe, expect, it } from 'vitest';

describe('booking-flow helpers', () => {
  it('starts at subject step when there is exactly one student', () => {
    expect(shouldStartAtSubjectStep([{ id: 1, name: 'Leia Organa', grade: '8' }])).toBe(true);
    expect(
      shouldStartAtSubjectStep([
        { id: 1, name: 'Luke Skywalker', grade: '8' },
        { id: 2, name: 'Leia Organa', grade: '8' },
      ])
    ).toBe(false);
  });

  it('returns only tutors present in the subject assignments', () => {
    const tutors = [
      { id: 10, user_id: 101, name: 'A Tutor', education: null, years_experience: 3, typicalAvailability: null },
      { id: 20, user_id: 102, name: 'B Tutor', education: null, years_experience: 5, typicalAvailability: null },
      { id: 30, user_id: 103, name: 'C Tutor', education: null, years_experience: 7, typicalAvailability: null },
    ];

    const result = selectTutorsForSubject(tutors, {
      assignments: [{ tutorId: 20 }, { tutorId: 30 }],
    });

    expect(result.map(tutor => tutor.id)).toEqual([20, 30]);
  });

  it('blocks booking when available credits are below the session requirement', () => {
    expect(shouldBlockForCredits(0, 2)).toBe(true);
    expect(shouldBlockForCredits(1, 2)).toBe(true);
    expect(shouldBlockForCredits(2, 2)).toBe(false);
  });

  it('derives slot units from the selected session range', () => {
    expect(
      getSessionSlotUnits({
        scheduled_at: '2026-03-02T15:00:00.000Z',
        ends_at: '2026-03-02T16:00:00.000Z',
      })
    ).toBe(2);
  });

  it('rejects selected sessions that are not multiples of 30 minutes', () => {
    expect(() =>
      getSessionSlotUnits({
        scheduled_at: '2026-03-02T15:00:00.000Z',
        ends_at: '2026-03-02T15:45:00.000Z',
      })
    ).toThrow('Selected session duration must be a positive multiple of 30 minutes');
  });
});
