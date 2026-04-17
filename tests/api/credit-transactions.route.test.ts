import { POST } from '@/app/api/credit-transactions/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCookies, mockGetParentIdByUserId, mockCreateCreditTransaction } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockGetParentIdByUserId: vi.fn(),
  mockCreateCreditTransaction: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
}));

vi.mock('@/lib/db/queries/credits/transactions', () => ({
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
  });

  it('derives the parent id for POST when the caller is a parent', async () => {
    mockGetParentIdByUserId.mockResolvedValueOnce(55);
    mockCreateCreditTransaction.mockResolvedValueOnce({
      id: 2002,
      parent_id: 55,
      session_id: null,
      available_delta_minutes: 4,
      pending_delta_minutes: 0,
      available_after_minutes: 8,
      pending_after_minutes: 1,
      idempotency_key: null,
      note: null,
      type: 'purchase',
      created_at: '2026-03-20T00:00:00.000Z',
    });

    const response = await POST(
      makePostRequest({
        parent_id: 999,
        available_delta_minutes: 4,
        pending_delta_minutes: 0,
        available_after_minutes: 8,
        pending_after_minutes: 1,
        type: 'purchase',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: 2002,
      parent_id: 55,
      available_delta_minutes: 4,
      pending_delta_minutes: 0,
      available_after_minutes: 8,
      pending_after_minutes: 1,
      type: 'purchase',
    });
    expect(mockCreateCreditTransaction).toHaveBeenCalledWith({
      parent_id: 55,
      session_id: null,
      available_delta_minutes: 4,
      pending_delta_minutes: 0,
      available_after_minutes: 8,
      pending_after_minutes: 1,
      idempotency_key: undefined,
      note: undefined,
      type: 'purchase',
    });
  });

  it('returns a JSON 500 when parent lookup fails during POST', async () => {
    mockGetParentIdByUserId.mockRejectedValueOnce(new Error('lookup failed'));

    const response = await POST(
      makePostRequest({
        parent_id: 9,
        available_delta_minutes: 4,
        pending_delta_minutes: 0,
        available_after_minutes: 8,
        pending_after_minutes: 1,
        type: 'purchase',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'lookup failed' });
  });
});
