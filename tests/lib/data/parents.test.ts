import { getParent, getParents } from '@/lib/data/parents';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetParent, mockGetParents } = vi.hoisted(() => ({
  mockGetParent: vi.fn(),
  mockGetParents: vi.fn(),
}));

vi.mock('@/features/parents/parents-service', () => ({
  parentDataService: {
    getParent: mockGetParent,
    getParents: mockGetParents,
  },
}));

describe('parent data compatibility wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('forwards list lookups to the feature service', async () => {
    const parents = [{ id: 1, user_id: 2, name: 'Jamie Adams', email: 'jamie@example.com' }];
    mockGetParents.mockResolvedValueOnce(parents);

    await expect(getParents('admin')).resolves.toBe(parents);
    expect(mockGetParents).toHaveBeenCalledWith('admin');
  });

  it('forwards detail lookups to the feature service', async () => {
    const parent = { id: 1, user_id: 2, name: 'Jamie Adams', email: 'jamie@example.com', students: [] };
    mockGetParent.mockResolvedValueOnce(parent);

    await expect(getParent(2, 'admin')).resolves.toBe(parent);
    expect(mockGetParent).toHaveBeenCalledWith(2, 'admin');
  });
});
