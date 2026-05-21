import { getTutor } from '@/lib/data/tutor-detail';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetTutor } = vi.hoisted(() => ({
  mockGetTutor: vi.fn(),
}));

vi.mock('@/features/tutors/tutors-service', () => ({
  getUserRole: vi.fn(),
  tutorDataService: {
    getTutor: mockGetTutor,
  },
}));

describe('tutor detail compatibility wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards detail lookups to the feature service', async () => {
    const tutor = { id: 8, user_id: 108, first_name: 'Maya', last_name: 'Nguyen' };
    mockGetTutor.mockResolvedValueOnce(tutor);

    await expect(getTutor(8)).resolves.toBe(tutor);
    expect(mockGetTutor).toHaveBeenCalledWith(8);
  });
});
