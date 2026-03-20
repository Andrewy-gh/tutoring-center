import { GET, PUT } from '@/app/api/credit-balances/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

function setCookies(role?: string, userId?: string) {
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'user-role' && role) return { value: role };
      if (name === 'user-id' && userId) return { value: userId };
      return undefined;
    }),
  });
}

function makePutRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/credit-balances', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createInsertQuery(result: unknown) {
  return {
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

describe('credit balances route auth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('parent', '42');
  });

  it('returns 401 for GET when role cookie is missing', async () => {
    setCookies(undefined, '42');

    const response = await GET(new Request('https://example.test/api/credit-balances?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 for GET when user is a tutor', async () => {
    setCookies('tutor', '42');

    const response = await GET(new Request('https://example.test/api/credit-balances?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('derives the parent id for GET when the caller is a parent', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 77 }]))
      .mockReturnValueOnce(createSelectQuery([{ parent_id: 77, amount_available: 8, amount_pending: 2 }]));

    const response = await GET(new Request('https://example.test/api/credit-balances?parent_id=999'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ parent_id: 77, amount_available: 8, amount_pending: 2 });
  });

  it('derives the parent id for PUT when the caller is a parent', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 55 }]))
      .mockReturnValueOnce(createSelectQuery([{ id: 55 }]));
    mockDbInsert.mockReturnValueOnce(createInsertQuery([{ parent_id: 55, amount_available: 6, amount_pending: 1 }]));

    const response = await PUT(makePutRequest({ parent_id: 999, amount_available: 6, amount_pending: 1 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ parent_id: 55, amount_available: 6, amount_pending: 1 });
  });
});
