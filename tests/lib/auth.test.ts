import { getCurrentUserName, getUserIdByRole } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockGetUserIdForRole, mockGetUserNameById, mockRedirect } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockGetUserIdForRole: vi.fn(),
  mockGetUserNameById: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(),
    redirect: vi.fn(),
  },
}));

vi.mock('@/lib/db/queries/actors', () => ({
  getUserIdForRole: mockGetUserIdForRole,
  getUserNameById: mockGetUserNameById,
}));

describe('auth helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCookies.mockResolvedValue({
      get: vi.fn((name: string) => (name === 'user-id' ? { value: '41' } : undefined)),
    });
  });

  it('returns the first admin user id via Drizzle', async () => {
    mockGetUserIdForRole.mockResolvedValueOnce(12);

    await expect(getUserIdByRole('admin')).resolves.toBe('12');
  });

  it('returns the current user name via Drizzle', async () => {
    mockGetUserNameById.mockResolvedValueOnce('Ada Lovelace');

    await expect(getCurrentUserName()).resolves.toBe('Ada Lovelace');
  });

  it('returns null when a role lookup query fails', async () => {
    mockGetUserIdForRole.mockRejectedValueOnce(new Error('db down'));

    await expect(getUserIdByRole('parent')).resolves.toBeNull();
  });
});
