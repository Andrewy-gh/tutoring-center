import { getTutorOptionsByIds } from '@/features/booking/booking-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockForbidden, mockGetTutorOptionRowsByIds } = vi.hoisted(() => ({
  mockForbidden: vi.fn(),
  mockGetTutorOptionRowsByIds: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
}));

vi.mock('@/db/queries/tutors', () => ({
  getTutorOptionRowsByIds: mockGetTutorOptionRowsByIds,
}));

describe('getTutorOptionsByIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('groups availability rows and preserves requested tutor ordering', async () => {
    mockGetTutorOptionRowsByIds.mockResolvedValueOnce([
      {
        id: 1,
        userId: 101,
        education: 'B.S. Physics',
        yearsExperience: 5,
        firstName: 'Sarah',
        lastName: 'Cole',
        email: 'sarah@example.com',
        phone: '555-0101',
        weekDay: 'Monday',
        startTime: '14:00',
        endTime: '16:00',
      },
      {
        id: 1,
        userId: 101,
        education: 'B.S. Physics',
        yearsExperience: 5,
        firstName: 'Sarah',
        lastName: 'Cole',
        email: 'sarah@example.com',
        phone: '555-0101',
        weekDay: 'Wednesday',
        startTime: '09:30',
        endTime: '10:30',
      },
      {
        id: 2,
        userId: 202,
        education: null,
        yearsExperience: null,
        firstName: 'Leo',
        lastName: 'Hart',
        email: 'leo@example.com',
        phone: null,
        weekDay: null,
        startTime: null,
        endTime: null,
      },
    ]);

    await expect(getTutorOptionsByIds('parent', [2, 1, 2])).resolves.toEqual([
      {
        id: 2,
        user_id: 202,
        name: 'Leo Hart',
        education: null,
        years_experience: null,
        typicalAvailability: null,
      },
      {
        id: 1,
        user_id: 101,
        name: 'Sarah Cole',
        education: 'B.S. Physics',
        years_experience: 5,
        typicalAvailability: 'Mon 2PM-4PM • Wed 9:30AM-10:30AM',
      },
    ]);

    expect(mockGetTutorOptionRowsByIds).toHaveBeenCalledWith([2, 1]);
  });

  it('blocks tutor role access', async () => {
    await expect(getTutorOptionsByIds('tutor', [1])).rejects.toThrow('forbidden');
    expect(mockGetTutorOptionRowsByIds).not.toHaveBeenCalled();
  });

  it('returns an empty array when ids are unusable', async () => {
    await expect(getTutorOptionsByIds('admin', [0, -1, 1.5])).resolves.toEqual([]);
    expect(mockGetTutorOptionRowsByIds).not.toHaveBeenCalled();
  });

  it('throws when the joined tutor options query fails', async () => {
    mockGetTutorOptionRowsByIds.mockRejectedValueOnce(new Error('db failed'));

    await expect(getTutorOptionsByIds('admin', [1])).rejects.toThrow(
      'Tutor options are temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws when joined tutor option rows fail validation', async () => {
    mockGetTutorOptionRowsByIds.mockResolvedValueOnce([
      {
        id: 1,
        userId: 101,
        education: 'B.S. Physics',
        yearsExperience: 5,
        firstName: 'Sarah',
        lastName: 'Cole',
        email: null,
        phone: '555-0101',
        weekDay: 'Monday',
        startTime: '14:00',
        endTime: '16:00',
      },
    ]);

    await expect(getTutorOptionsByIds('admin', [1])).rejects.toThrow(
      'Tutor options format is invalid. Please try again later.'
    );
  });
});
