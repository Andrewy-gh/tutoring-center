import { getTutorProfileMapByIds, getTutors } from '@/lib/data/tutors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockForbidden, mockDbSelect } = vi.hoisted(() => ({
  mockForbidden: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
  redirect: vi.fn(),
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
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('getTutors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('returns tutor rows from a Drizzle join', async () => {
    const query = createSelectQuery([
      {
        id: 1,
        userId: 101,
        verified: true,
        education: 'M.S. in Mathematics, NYU',
        bio: 'Patient tutor',
        tagline: 'Algebra specialist',
        yearsExperience: 8,
        firstName: 'Sarah',
        lastName: 'Jennings',
        email: 'sarah.j@tutor.mail',
        phone: '(212) 555-0101',
      },
      {
        id: 2,
        userId: 102,
        verified: false,
        education: null,
        bio: null,
        tagline: null,
        yearsExperience: null,
        firstName: 'Avery',
        lastName: null,
        email: 'avery@tutor.mail',
        phone: null,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutors('admin')).resolves.toEqual([
      {
        id: 1,
        user_id: 101,
        name: 'Sarah Jennings',
        email: 'sarah.j@tutor.mail',
        phone: '(212) 555-0101',
        education: 'M.S. in Mathematics, NYU',
        verified: true,
        years_experience: 8,
      },
      {
        id: 2,
        user_id: 102,
        name: 'Avery',
        email: 'avery@tutor.mail',
        phone: '—',
        education: '—',
        verified: false,
        years_experience: 0,
      },
    ]);

    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.orderBy).toHaveBeenCalledTimes(1);
  });

  it('throws forbidden when role is not admin', async () => {
    await expect(getTutors('parent')).rejects.toThrow('forbidden');
    await expect(getTutors('tutor')).rejects.toThrow('forbidden');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('throws when role is invalid', async () => {
    await expect(getTutors('invalid' as 'admin')).rejects.toThrow('Role is required to fetch tutors.');
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('throws when the tutor query fails', async () => {
    const query = createSelectQuery([]);
    query.then.mockImplementationOnce((_resolve, reject) =>
      Promise.reject(new Error('Database error')).then(undefined, reject)
    );
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutors('admin')).rejects.toThrow(
      'Tutor data is temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws when joined tutor rows fail validation', async () => {
    const query = createSelectQuery([
      {
        id: 'bad-id',
        userId: 101,
        verified: true,
        education: 'M.S. in Mathematics, NYU',
        bio: 'Patient tutor',
        tagline: 'Algebra specialist',
        yearsExperience: 8,
        firstName: 'Sarah',
        lastName: 'Jennings',
        email: 'sarah.j@tutor.mail',
        phone: '(212) 555-0101',
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutors('admin')).rejects.toThrow('Tutor data format is invalid. Please try again later.');
  });
});

describe('getTutorProfileMapByIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns profile rows keyed by tutor id', async () => {
    const query = createSelectQuery([
      {
        id: 7,
        firstName: 'Nina',
        lastName: 'Patel',
        email: 'nina@example.com',
        phone: '555-0123',
      },
      {
        id: 9,
        firstName: null,
        lastName: null,
        email: 'blank@example.com',
        phone: null,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutorProfileMapByIds([9, 7, 9, -1])).resolves.toEqual(
      new Map([
        [
          7,
          {
            id: 7,
            name: 'Nina Patel',
            email: 'nina@example.com',
            phone: '555-0123',
          },
        ],
        [
          9,
          {
            id: 9,
            name: '—',
            email: 'blank@example.com',
            phone: '—',
          },
        ],
      ])
    );

    expect(query.where).toHaveBeenCalledTimes(1);
  });

  it('returns an empty map without querying when ids are unusable', async () => {
    await expect(getTutorProfileMapByIds([0, -3, 1.5])).resolves.toEqual(new Map());
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
