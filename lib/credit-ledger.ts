import type { TransactionType } from '@/lib/db/schema';

export type CreditLedgerSnapshot = {
  available_after: number;
  pending_after: number;
};

export type CreditLedgerDelta = CreditLedgerSnapshot & {
  available_delta: number;
  pending_delta: number;
  type: TransactionType;
};

export function getNetCreditDelta({
  available_delta,
  pending_delta,
}: Pick<CreditLedgerDelta, 'available_delta' | 'pending_delta'>) {
  return available_delta + pending_delta;
}

export function formatSignedCredits(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

export function getCreditTransactionSummary(transaction: CreditLedgerDelta) {
  const netAmount = getNetCreditDelta(transaction);

  switch (transaction.type) {
    case 'purchase':
      return `Added ${Math.abs(netAmount)} credit${Math.abs(netAmount) === 1 ? '' : 's'}`;
    case 'reservation':
      return `Reserved ${Math.abs(transaction.pending_delta)} credit${Math.abs(transaction.pending_delta) === 1 ? '' : 's'}`;
    case 'reservation_release':
      return `Released ${Math.abs(transaction.available_delta)} credit${Math.abs(transaction.available_delta) === 1 ? '' : 's'}`;
    case 'session_debit':
      return `Used ${Math.abs(netAmount)} credit${Math.abs(netAmount) === 1 ? '' : 's'}`;
    case 'refund':
      return `Refunded ${Math.abs(netAmount)} credit${Math.abs(netAmount) === 1 ? '' : 's'}`;
    case 'cancellation_fee':
      return `Charged ${Math.abs(netAmount)} credit${Math.abs(netAmount) === 1 ? '' : 's'}`;
    case 'adjustment':
      if (netAmount > 0) {
        return `Adjusted +${netAmount} credits`;
      }

      if (netAmount < 0) {
        return `Adjusted ${netAmount} credits`;
      }

      return 'Adjusted credits';
  }
}
