import { GET, PUT } from '@/app/api/credit-balances/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCookies,
  mockGetParentIdByUserId,
  mockParentExists,
  mockGetCreditBalanceByParentId,
  mockUpsertCreditBalance,
} = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockGetParentIdByUserId: vi.fn(),
  mockParentExists: vi.fn(),
  mockGetCreditBalanceByParentId: vi.fn(),
  mockUpsertCreditBalance: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
  parentExists: mockParentExists,
}));

vi.mock('@/db/queries/credits/balances', () => ({
  getCreditBalanceByParentId: mockGetCreditBalanceByParentId,
  upsertCreditBalance: mockUpsertCreditBalance,
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
    mockGetParentIdByUserId.mockResolvedValueOnce(77);
    mockGetCreditBalanceByParentId.mockResolvedValueOnce({ parent_id: 77, available_minutes: 8, pending_minutes: 2 });

    const response = await GET(new Request('https://example.test/api/credit-balances?parent_id=999'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ parent_id: 77, available_minutes: 8, pending_minutes: 2 });
  });

  it('derives the parent id for PUT when the caller is a parent', async () => {
    mockGetParentIdByUserId.mockResolvedValueOnce(55);
    mockParentExists.mockResolvedValueOnce(true);
    mockUpsertCreditBalance.mockResolvedValueOnce({ parent_id: 55, available_minutes: 6, pending_minutes: 1 });

    const response = await PUT(makePutRequest({ parent_id: 999, available_minutes: 6, pending_minutes: 1 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ parent_id: 55, available_minutes: 6, pending_minutes: 1 });
    expect(mockUpsertCreditBalance).toHaveBeenCalledWith(55, { available_minutes: 6, pending_minutes: 1 });
  });

  it('returns a JSON 500 when the balance upsert fails', async () => {
    mockGetParentIdByUserId.mockResolvedValueOnce(55);
    mockParentExists.mockResolvedValueOnce(true);
    mockUpsertCreditBalance.mockRejectedValueOnce(new Error('upsert failed'));

    const response = await PUT(makePutRequest({ parent_id: 999, available_minutes: 6, pending_minutes: 1 }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'upsert failed' });
  });

  it('returns a JSON 500 when parent lookup fails during GET', async () => {
    mockGetParentIdByUserId.mockRejectedValueOnce(new Error('lookup failed'));

    const response = await GET(new Request('https://example.test/api/credit-balances?parent_id=9'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'lookup failed' });
  });
});
