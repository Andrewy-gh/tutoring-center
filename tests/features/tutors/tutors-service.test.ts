import { getTutor, getTutorProfileMapByIds, getTutors } from '@/features/tutors/tutors-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockForbidden, mockNotFound, mockGetTutorJoinRows, mockGetTutorJoinRowById, mockGetTutorProfileRowsByIds } =
  vi.hoisted(() => ({
    mockForbidden: vi.fn(),
    mockNotFound: vi.fn(),
    mockGetTutorJoinRows: vi.fn(),
    mockGetTutorJoinRowById: vi.fn(),
    mockGetTutorProfileRowsByIds: vi.fn(),
  }));

vi.mock('next/navigation', () => ({
  forbidden: mockForbidden,
  notFound: mockNotFound,
}));

vi.mock('@/db/queries/tutors', () => ({
  getTutorJoinRows: mockGetTutorJoinRows,
  getTutorJoinRowById: mockGetTutorJoinRowById,
  getTutorProfileRowsByIds: mockGetTutorProfileRowsByIds,
}));

describe('getTutors', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockForbidden.mockImplementation(() => {
      throw new Error('forbidden');
    });
  });

  it('returns tutor rows from joined tutor rows', async () => {
    mockGetTutorJoinRows.mockResolvedValueOnce([
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

    expect(mockGetTutorJoinRows).toHaveBeenCalledTimes(1);
  });

  it('throws forbidden when role is not admin', async () => {
    await expect(getTutors('parent')).rejects.toThrow('forbidden');
    await expect(getTutors('tutor')).rejects.toThrow('forbidden');
    expect(mockGetTutorJoinRows).not.toHaveBeenCalled();
  });

  it('throws when the tutor query fails', async () => {
    mockGetTutorJoinRows.mockRejectedValueOnce(new Error('Database error'));

    await expect(getTutors('admin')).rejects.toThrow(
      'Tutor data is temporarily unavailable. Please retry in a moment.'
    );
  });

  it('throws when joined tutor rows fail validation', async () => {
    mockGetTutorJoinRows.mockResolvedValueOnce([
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

    await expect(getTutors('admin')).rejects.toThrow('Tutor data format is invalid. Please try again later.');
  });
});

describe('getTutor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error('notFound');
    });
  });

  it('maps a joined tutor detail row', async () => {
    mockGetTutorJoinRowById.mockResolvedValueOnce({
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
    });

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

    expect(mockGetTutorJoinRowById).toHaveBeenCalledWith(8);
  });

  it('throws notFound when the tutor is missing', async () => {
    mockGetTutorJoinRowById.mockResolvedValueOnce(undefined);

    await expect(getTutor(999)).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('throws notFound when the joined row is invalid', async () => {
    mockGetTutorJoinRowById.mockResolvedValueOnce({
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
    });

    await expect(getTutor(8)).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it('throws notFound when the query fails', async () => {
    mockGetTutorJoinRowById.mockRejectedValueOnce(new Error('db failed'));

    await expect(getTutor(8)).rejects.toThrow('notFound');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});

describe('getTutorProfileMapByIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns profile rows keyed by tutor id', async () => {
    mockGetTutorProfileRowsByIds.mockResolvedValueOnce([
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

    expect(mockGetTutorProfileRowsByIds).toHaveBeenCalledWith([9, 7]);
  });

  it('returns an empty map without querying when ids are unusable', async () => {
    await expect(getTutorProfileMapByIds([0, -3, 1.5])).resolves.toEqual(new Map());
    expect(mockGetTutorProfileRowsByIds).not.toHaveBeenCalled();
  });
});
