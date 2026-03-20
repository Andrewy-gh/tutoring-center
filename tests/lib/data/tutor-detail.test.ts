import { getTutor } from '@/lib/data/tutor-detail';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNotFound, mockDbSelect } = vi.hoisted(() => ({
  mockNotFound: vi.fn(),
  mockDbSelect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
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
    limit: vi.fn().mockResolvedValue(result),
  };

  return query;
}

describe('getTutor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('maps a joined tutor detail row', async () => {
    const query = createSelectQuery([
      {
        id: 8,
        userId: 108,
        verified: true,
        education: 'B.A. English',
        bio: 'Focus on writing confidence.',
        tagline: 'Essay support',
        yearsExperience: 6,
        firstName: 'Maya',
        lastName: 'Nguyen',
        email: 'maya@example.com',
        phone: null,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutor(8)).resolves.toEqual({
      id: 8,
      user_id: 108,
      first_name: 'Maya',
      last_name: 'Nguyen',
      email: 'maya@example.com',
      phone: '—',
      education: 'B.A. English',
      bio: 'Focus on writing confidence.',
      tagline: 'Essay support',
      verified: true,
      years_experience: 6,
    });

    expect(query.innerJoin).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledTimes(1);
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it('throws notFound when the tutor is missing', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([]));

    await expect(getTutor(999)).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('throws notFound when the joined row is invalid', async () => {
    const query = createSelectQuery([
      {
        id: 8,
        userId: 108,
        verified: true,
        education: 'B.A. English',
        bio: 'Focus on writing confidence.',
        tagline: 'Essay support',
        yearsExperience: 6,
        firstName: 'Maya',
        lastName: 'Nguyen',
        email: null,
        phone: null,
      },
    ]);
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutor(8)).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('throws notFound when the query fails', async () => {
    const query = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      limit: vi.fn().mockRejectedValue(new Error('db failed')),
    };
    mockDbSelect.mockReturnValueOnce(query);

    await expect(getTutor(8)).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});
