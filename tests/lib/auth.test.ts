import { getCurrentUserName, getUserIdByRole } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockDbSelect, mockRedirect } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockDbSelect: vi.fn(),
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
    limit: vi.fn().mockResolvedValue(result),
  };

  return query;
}

describe('auth helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCookies.mockResolvedValue({
      get: vi.fn((name: string) => (name === 'user-id' ? { value: '41' } : undefined)),
    });
  });

  it('returns the first admin user id via Drizzle', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 12 }]));

    await expect(getUserIdByRole('admin')).resolves.toBe('12');
  });

  it('returns the current user name via Drizzle', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ firstName: 'Ada', lastName: 'Lovelace' }]));

    await expect(getCurrentUserName()).resolves.toBe('Ada Lovelace');
  });

  it('returns null when a role lookup query fails', async () => {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockRejectedValue(new Error('db down')),
        })),
      })),
    });

    await expect(getUserIdByRole('parent')).resolves.toBeNull();
  });
});
