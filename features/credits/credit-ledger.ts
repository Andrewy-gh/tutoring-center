import type { TransactionType } from '@/db/types';
import { formatHours, minutesToHours } from '@/lib/billing-units';

export type CreditLedgerSnapshot = {
  available_after_minutes: number;
  pending_after_minutes: number;
};

export type CreditLedgerDelta = CreditLedgerSnapshot & {
  available_delta_minutes: number;
  pending_delta_minutes: number;
  type: TransactionType;
};

export function getNetCreditDelta({
  available_delta_minutes,
  pending_delta_minutes,
}: Pick<CreditLedgerDelta, 'available_delta_minutes' | 'pending_delta_minutes'>) {
  return available_delta_minutes + pending_delta_minutes;
}

export function formatSignedCredits(value: number) {
  const hours = minutesToHours(value);
  const formatted = formatHours(Math.abs(hours));

  if (hours > 0) {
    return `+${formatted}`;
  }

  if (hours < 0) {
    return `-${formatted}`;
  }

  return '0';
}

function formatCreditLabelFromMinutes(minutes: number) {
  const hours = minutesToHours(Math.abs(minutes));
  return `${formatHours(hours)} credit${hours === 1 ? '' : 's'}`;
}

export function getCreditTransactionSummary(transaction: CreditLedgerDelta) {
  const netAmount = getNetCreditDelta(transaction);

  switch (transaction.type) {
    case 'purchase':
      return `Added ${formatCreditLabelFromMinutes(netAmount)}`;
    case 'reservation':
      return `Reserved ${formatCreditLabelFromMinutes(transaction.pending_delta_minutes)}`;
    case 'reservation_release':
      return `Released ${formatCreditLabelFromMinutes(transaction.available_delta_minutes)}`;
    case 'session_debit':
      return `Used ${formatCreditLabelFromMinutes(netAmount)}`;
    case 'refund':
      return `Refunded ${formatCreditLabelFromMinutes(netAmount)}`;
    case 'cancellation_fee':
      return `Charged ${formatCreditLabelFromMinutes(netAmount)}`;
    case 'adjustment':
      if (netAmount > 0) {
        return `Adjusted +${formatHours(minutesToHours(netAmount))} credits`;
      }

      if (netAmount < 0) {
        return `Adjusted ${formatHours(minutesToHours(netAmount))} credits`;
      }

      return 'Adjusted credits';
  }
}
