import { GET, POST } from '@/app/api/credit-transactions/route';
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

function makePostRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/credit-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(() => query),
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

function createInsertQuery(result: unknown) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue(result),
    })),
  };
}

describe('credit transactions route auth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('parent', '42');
  });

  it('returns 401 for GET when role cookie is missing', async () => {
    setCookies(undefined, '42');

    const response = await GET(new Request('https://example.test/api/credit-transactions?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('derives the parent id for GET when the caller is a parent', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 88 }]))
      .mockReturnValueOnce(createSelectQuery([{ count: 0 }]));

    const response = await GET(
      new Request('https://example.test/api/credit-transactions?parent_id=999&page=1&page_size=20')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.filters.parent_id).toBe(88);
  });

  it('derives the parent id for POST when the caller is a parent', async () => {
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 55 }]));
    mockDbInsert.mockReturnValueOnce(
      createInsertQuery([
        {
          id: 2002,
          parent_id: 55,
          session_id: null,
          available_delta: 4,
          pending_delta: 0,
          available_after: 8,
          pending_after: 1,
          idempotency_key: null,
          note: null,
          type: 'purchase',
          created_at: '2026-03-20T00:00:00.000Z',
        },
      ])
    );

    const response = await POST(
      makePostRequest({
        parent_id: 999,
        available_delta: 4,
        pending_delta: 0,
        available_after: 8,
        pending_after: 1,
        type: 'purchase',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: 2002,
      parent_id: 55,
      available_delta: 4,
      pending_delta: 0,
      available_after: 8,
      pending_after: 1,
      type: 'purchase',
    });
  });

  it('returns a JSON 500 when parent lookup fails during GET', async () => {
    mockDbSelect.mockReturnValueOnce(createRejectingSelectQuery('lookup failed'));

    const response = await GET(new Request('https://example.test/api/credit-transactions?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'lookup failed' });
  });
});
