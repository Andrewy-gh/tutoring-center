import { type CreditBalance } from '@/lib/credit-balances';

export type CreditMutationResult = {
  balance: CreditBalance;
  warning?: string;
};

type CreditTransactionPayload = {
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
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
    amount_available: typeof balance?.amount_available === 'number' ? balance.amount_available : 0,
    amount_pending: typeof balance?.amount_pending === 'number' ? balance.amount_pending : 0,
  };
}

async function saveCreditBalance(parentId: number, balance: CreditBalance) {
  const response = await fetch('/api/credit-balances', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parent_id: parentId,
      amount_available: balance.amount_available,
      amount_pending: balance.amount_pending,
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
  const nextBalance = {
    amount_available: currentBalance.amount_available + credits,
    amount_pending: currentBalance.amount_pending,
  };

  const balance = await saveCreditBalance(parentId, nextBalance);

  try {
    await saveCreditTransaction({
      available_delta: credits,
      pending_delta: 0,
      available_after: balance.amount_available,
      pending_after: balance.amount_pending,
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
