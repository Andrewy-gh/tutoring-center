import { GET, POST } from '@/app/api/credit-transactions/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCookies,
  mockGetParentIdByUserId,
  mockBuildCreditTransactionFilters,
  mockGetCreditTransactionCount,
  mockGetCreditTransactionRows,
  mockParseCreditTransactionRows,
  mockCreateCreditTransaction,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockGetParentIdByUserId: vi.fn(),
  mockBuildCreditTransactionFilters: vi.fn(),
  mockGetCreditTransactionCount: vi.fn(),
  mockGetCreditTransactionRows: vi.fn(),
  mockParseCreditTransactionRows: vi.fn(),
  mockCreateCreditTransaction: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
}));

vi.mock('@/lib/db/queries/credits/transactions', () => ({
  buildCreditTransactionFilters: mockBuildCreditTransactionFilters,
  getCreditTransactionCount: mockGetCreditTransactionCount,
  getCreditTransactionRows: mockGetCreditTransactionRows,
  parseCreditTransactionRows: mockParseCreditTransactionRows,
  createCreditTransaction: mockCreateCreditTransaction,
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

describe('credit transactions route auth', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('parent', '42');
    mockBuildCreditTransactionFilters.mockReturnValue([]);
    mockParseCreditTransactionRows.mockReturnValue({ success: true, data: [] });
  });

  it('returns 401 for GET when role cookie is missing', async () => {
    setCookies(undefined, '42');

    const response = await GET(new Request('https://example.test/api/credit-transactions?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('derives the parent id for GET when the caller is a parent', async () => {
    mockGetParentIdByUserId.mockResolvedValueOnce(88);
    mockGetCreditTransactionCount.mockResolvedValueOnce(0);

    const response = await GET(
      new Request('https://example.test/api/credit-transactions?parent_id=999&page=1&page_size=20')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(body.filters.parent_id).toBe(88);
    expect(mockBuildCreditTransactionFilters).toHaveBeenCalledWith({
      parentId: 88,
      studentId: undefined,
      sessionId: undefined,
      type: 'all',
      startDate: undefined,
      endDate: undefined,
    });
  });

  it('derives the parent id for POST when the caller is a parent', async () => {
    mockGetParentIdByUserId.mockResolvedValueOnce(55);
    mockCreateCreditTransaction.mockResolvedValueOnce({
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
    });

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
    expect(mockCreateCreditTransaction).toHaveBeenCalledWith({
      parent_id: 55,
      session_id: null,
      available_delta: 4,
      pending_delta: 0,
      available_after: 8,
      pending_after: 1,
      idempotency_key: undefined,
      note: undefined,
      type: 'purchase',
    });
  });

  it('returns a JSON 500 when parent lookup fails during GET', async () => {
    mockGetParentIdByUserId.mockRejectedValueOnce(new Error('lookup failed'));

    const response = await GET(new Request('https://example.test/api/credit-transactions?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'lookup failed' });
  });
});
