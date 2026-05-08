import { type CreditBalance } from '@/features/credits/credit-balances';
import { creditsToMinutes } from '@/lib/billing-units';

export type CreditMutationResult = {
  balance: CreditBalance;
  warning?: string;
};

type CreditTransactionPayload = {
  available_delta_minutes: number;
  pending_delta_minutes: number;
  available_after_minutes: number;
  pending_after_minutes: number;
  parent_id: number;
  session_id?: number;
  idempotency_key?: string;
  note?: string;
  type: 'purchase';
};

type CreditBalanceResponse = Partial<CreditBalance> & {
  error?: string;
};

function normalizeCreditBalance(balance: Partial<CreditBalance> | null | undefined) {
  return {
    available_minutes: typeof balance?.available_minutes === 'number' ? balance.available_minutes : 0,
    pending_minutes: typeof balance?.pending_minutes === 'number' ? balance.pending_minutes : 0,
  };
}

async function saveCreditBalance(parentId: number, balance: CreditBalance) {
  const response = await fetch('/api/credit-balances', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent_id: parentId,
      available_minutes: balance.available_minutes,
      pending_minutes: balance.pending_minutes,
    }),
  });

  const body = (await response.json().catch(() => null)) as CreditBalanceResponse | null;
  if (!response.ok) {
    throw new Error(body?.error ?? 'Could not update credit balance right now.');
  }

  return normalizeCreditBalance(body ?? balance);
}

async function saveCreditTransaction(input: CreditTransactionPayload) {
  const response = await fetch('/api/credit-transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.error ?? 'Could not record the credit transaction right now.');
  }
}

export async function purchaseParentCredits(parentId: number, credits: number, currentBalance: CreditBalance) {
  const purchasedMinutes = creditsToMinutes(credits);
  const nextBalance = {
    available_minutes: currentBalance.available_minutes + purchasedMinutes,
    pending_minutes: currentBalance.pending_minutes,
  };

  const balance = await saveCreditBalance(parentId, nextBalance);

  try {
    await saveCreditTransaction({
      available_delta_minutes: purchasedMinutes,
      pending_delta_minutes: 0,
      available_after_minutes: balance.available_minutes,
      pending_after_minutes: balance.pending_minutes,
      parent_id: parentId,
      type: 'purchase',
    });
  } catch {
    return {
      balance,
      warning: 'Credits were added, but the purchase entry could not be recorded in credit history.',
    };
  }

  return { balance };
}
