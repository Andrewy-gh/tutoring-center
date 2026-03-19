import { getCreditTransactionSummary, getNetCreditDelta } from '@/lib/credit-ledger';
import { describe, expect, it } from 'vitest';

describe('credit ledger helpers', () => {
  it('derives a zero net amount for reservations while preserving reservation-specific copy', () => {
    const transaction = {
      type: 'reservation' as const,
      available_delta: -1,
      pending_delta: 1,
      available_after: 4,
      pending_after: 1,
    };

    expect(getNetCreditDelta(transaction)).toBe(0);
    expect(getCreditTransactionSummary(transaction)).toBe('Reserved 1 credit');
  });

  it('derives a negative net amount for session debits', () => {
    const transaction = {
      type: 'session_debit' as const,
      available_delta: 0,
      pending_delta: -2,
      available_after: 4,
      pending_after: 0,
    };

    expect(getNetCreditDelta(transaction)).toBe(-2);
    expect(getCreditTransactionSummary(transaction)).toBe('Used 2 credits');
  });
});
