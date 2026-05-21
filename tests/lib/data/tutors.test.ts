import { getTutorProfileMapByIds, getTutors } from '@/lib/data/tutors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetTutorProfileMapByIds, mockGetTutors } = vi.hoisted(() => ({
  mockGetTutorProfileMapByIds: vi.fn(),
  mockGetTutors: vi.fn(),
}));

vi.mock('@/features/tutors/tutors-service', () => ({
  getUserRole: vi.fn(),
  tutorDataService: {
    getTutorProfileMapByIds: mockGetTutorProfileMapByIds,
    getTutors: mockGetTutors,
  },
}));

describe('tutor data compatibility wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards profile map lookups to the feature service', async () => {
    const tutorMap = new Map([[1, { id: 1, name: 'Nina Patel', email: 'nina@example.com', phone: '555-0123' }]]);
    mockGetTutorProfileMapByIds.mockResolvedValueOnce(tutorMap);

    await expect(getTutorProfileMapByIds([1])).resolves.toBe(tutorMap);
    expect(mockGetTutorProfileMapByIds).toHaveBeenCalledWith([1]);
  });

  it('forwards list lookups to the feature service', async () => {
    const tutors = [{ id: 1, user_id: 2, name: 'Nina Patel', email: 'nina@example.com' }];
    mockGetTutors.mockResolvedValueOnce(tutors);

    await expect(getTutors('admin')).resolves.toBe(tutors);
    expect(mockGetTutors).toHaveBeenCalledWith('admin');
  });
});
