import { purchaseParentCredits } from '@/features/credits';
import { describe, expect, it, vi } from 'vitest';

describe('credit mutations', () => {
  it('records a purchase after updating the parent balance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available_minutes: 180, pending_minutes: 60 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 99 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(purchaseParentCredits(44, 3, { available_minutes: 0, pending_minutes: 60 })).resolves.toEqual({
      balance: {
        available_minutes: 180,
        pending_minutes: 60,
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/credit-balances',
      expect.objectContaining({
        method: 'PUT',
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/credit-transactions',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const updateBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const transactionBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(updateBody).toEqual({
      parent_id: 44,
      available_minutes: 180,
      pending_minutes: 60,
    });
    expect(transactionBody).toEqual({
      parent_id: 44,
      available_delta_minutes: 180,
      pending_delta_minutes: 0,
      available_after_minutes: 180,
      pending_after_minutes: 60,
      type: 'purchase',
    });
  });

  it('returns a warning when the balance update succeeds but the transaction write fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ available_minutes: 180, pending_minutes: 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'insert failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(purchaseParentCredits(21, 2, { available_minutes: 60, pending_minutes: 0 })).resolves.toEqual({
      balance: {
        available_minutes: 180,
        pending_minutes: 0,
      },
      warning: 'Credits were added, but the purchase entry could not be recorded in credit history.',
    });
  });
});
