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
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createRejectingSelectQuery(message: string) {
  const query = createSelectQuery([]);
  query.then.mockImplementationOnce((_resolve, reject) => Promise.reject(new Error(message)).then(undefined, reject));
  return query;
}

describe('getTutors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('returns tutors data when role is admin', async () => {
    mockDbSelect.mockReturnValueOnce(
      createSelectQuery([
        {
          id: 1,
          user_id: 101,
          verified: true,
          education: 'M.S. in Mathematics, NYU',
          bio: null,
          tagline: null,
          years_experience: 8,
          first_name: 'Sarah',
          last_name: 'Jennings',
          email: 'sarah.j@tutor.mail',
          phone: '(212) 555-0101',
        },
      ])
    );

    const { getTutors } = await import('@/lib/data/tutors');
    const tutors = await getTutors('admin');

    expect(tutors).toHaveLength(1);
    expect(tutors[0]).toEqual({
      id: 1,
      user_id: 101,
      name: 'Sarah Jennings',
      email: 'sarah.j@tutor.mail',
      phone: '(212) 555-0101',
      education: 'M.S. in Mathematics, NYU',
      verified: true,
      years_experience: 8,
    });
  });

  it('throws forbidden error when role is not admin', async () => {
    const { getTutors } = await import('@/lib/data/tutors');
    await expect(getTutors('parent')).rejects.toThrow('forbidden');
    await expect(getTutors('tutor')).rejects.toThrow('forbidden');
  });

  it('throws error when role is invalid', async () => {
    const { getTutors } = await import('@/lib/data/tutors');
    await expect(getTutors('invalid' as 'admin')).rejects.toThrow('Role is required to fetch tutors.');
  });

  it('throws error when database query fails', async () => {
    mockDbSelect.mockReturnValueOnce(createRejectingSelectQuery('Database error'));

    const { getTutors } = await import('@/lib/data/tutors');
    await expect(getTutors('admin')).rejects.toThrow(
      'Tutor data is temporarily unavailable. Please retry in a moment.'
    );
  });
});
