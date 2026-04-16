import { getCurrentUserName, getUserIdByRole, login } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockCookieStore, mockGetUserIdForRole, mockGetUserNameById, mockRedirect } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockCookieStore: {
    get: vi.fn(),
    set: vi.fn(),
  },
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
    mockCookieStore.get.mockImplementation((name: string) => (name === 'user-id' ? { value: '41' } : undefined));
    mockCookies.mockResolvedValue(mockCookieStore);
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

  it('redirects back to login instead of writing a fake cookie when a role has no seeded user', async () => {
    mockGetUserIdForRole.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.set('role', 'parent');

    await login(formData);

    expect(mockCookieStore.set).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith('/login?error=missing-local-user&role=parent');
  });

  it('sets auth cookies and redirects to the dashboard when a role lookup succeeds', async () => {
    mockGetUserIdForRole.mockResolvedValueOnce(12);

    const formData = new FormData();
    formData.set('role', 'parent');

    await login(formData);

    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
    expect(mockCookieStore.set).toHaveBeenNthCalledWith(
      1,
      'user-role',
      'parent',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 3600,
        path: '/',
        sameSite: 'lax',
      })
    );
    expect(mockCookieStore.set).toHaveBeenNthCalledWith(
      2,
      'user-id',
      '12',
      expect.objectContaining({
        httpOnly: true,
        maxAge: 3600,
        path: '/',
        sameSite: 'lax',
      })
    );
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
