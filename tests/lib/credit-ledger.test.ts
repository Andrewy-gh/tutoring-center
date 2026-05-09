import { getCreditTransactionSummary, getNetCreditDelta } from '@/features/credits/credit-ledger';
import { describe, expect, it } from 'vitest';

describe('credit ledger helpers', () => {
  it('derives a zero net amount for reservations while preserving reservation-specific copy', () => {
    const transaction = {
      type: 'reservation' as const,
      available_delta_minutes: -60,
      pending_delta_minutes: 60,
      available_after_minutes: 120,
      pending_after_minutes: 60,
    };

    expect(getNetCreditDelta(transaction)).toBe(0);
    expect(getCreditTransactionSummary(transaction)).toBe('Reserved 1 credit');
  });

  it('derives a negative net amount for session debits', () => {
    const transaction = {
      type: 'session_debit' as const,
      available_delta_minutes: 0,
      pending_delta_minutes: -60,
      available_after_minutes: 120,
      pending_after_minutes: 0,
    };

    expect(getNetCreditDelta(transaction)).toBe(-60);
    expect(getCreditTransactionSummary(transaction)).toBe('Used 1 credit');
  });
});
