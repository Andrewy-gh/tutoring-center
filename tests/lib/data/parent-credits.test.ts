import { EMPTY_CREDIT_BALANCE } from '@/lib/credit-balances';
import { getCurrentParentBalance, getCurrentParentCredits } from '@/lib/data/parent-credits';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUserID, mockGetParentIdByUserId, mockGetCreditBalanceByParentId, mockNotFound } = vi.hoisted(
  () => ({
    mockGetCurrentUserID: vi.fn(),
    mockGetParentIdByUserId: vi.fn(),
    mockGetCreditBalanceByParentId: vi.fn(),
    mockNotFound: vi.fn(() => {
      throw new Error('notFound');
    }),
  })
);

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: mockGetCurrentUserID,
}));

vi.mock('@/lib/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
}));

vi.mock('@/lib/db/queries/credits/balances', () => ({
  getCreditBalanceByParentId: mockGetCreditBalanceByParentId,
}));

describe('parent credits data', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCurrentUserID.mockResolvedValue(42);
    mockGetParentIdByUserId.mockResolvedValue(77);
  });

  it('returns the current parent balance from the shared balance query', async () => {
    mockGetCreditBalanceByParentId.mockResolvedValueOnce({
      parent_id: 77,
      amount_available: 8,
      amount_pending: 2,
    });

    await expect(getCurrentParentBalance()).resolves.toEqual({
      amount_available: 8,
      amount_pending: 2,
    });
  });

  it('returns the empty balance when no balance row exists', async () => {
    mockGetCreditBalanceByParentId.mockResolvedValueOnce(null);

    await expect(getCurrentParentBalance()).resolves.toEqual(EMPTY_CREDIT_BALANCE);
    await expect(getCurrentParentCredits()).resolves.toEqual({
      parentId: 77,
      balance: EMPTY_CREDIT_BALANCE,
    });
  });

  it('throws a user-facing error when the balance query fails', async () => {
    mockGetCreditBalanceByParentId.mockRejectedValueOnce(new Error('db down'));

    await expect(getCurrentParentCredits()).rejects.toThrow(
      'Your credit balance is temporarily unavailable. Please try again in a moment.'
    );
  });
});
