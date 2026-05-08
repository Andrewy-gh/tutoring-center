import { getTutorOptionsByIds } from '@/lib/data/tutor-options';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockForbidden, mockDbSelect } = vi.hoisted(() => ({
  mockForbidden: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('getTutorOptionsByIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('groups availability rows and preserves requested tutor ordering', async () => {
    const query = createSelectQuery([
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
    mockDbSelect.mockReturnValueOnce(query);

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

    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.leftJoin).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledTimes(1);
  });

  it('blocks tutor role access', async () => {
    await expect(getTutorOptionsByIds('tutor', [1])).rejects.toThrow('forbidden');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns an empty array when ids are unusable', async () => {
    await expect(getTutorOptionsByIds('admin', [0, -1, 1.5])).resolves.toEqual([]);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('throws when the joined tutor options query fails', async () => {
    const query = createSelectQuery([]);
    query.then.mockImplementationOnce((_resolve, reject) =>
      Promise.reject(new Error('db failed')).then(undefined, reject)
    );
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutorOptionsByIds('admin', [1])).rejects.toThrow(
      'Tutor options are temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws when joined tutor option rows fail validation', async () => {
    const query = createSelectQuery([
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
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutorOptionsByIds('admin', [1])).rejects.toThrow(
      'Tutor options format is invalid. Please try again later.'
    );
  });
});
