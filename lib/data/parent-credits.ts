import 'server-only';
import { notFound } from 'next/navigation';
import { getCurrentUserID } from '@/lib/auth';
import { EMPTY_CREDIT_BALANCE } from '@/lib/credit-balances';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import { getCreditBalanceByParentId } from '@/lib/db/queries/credits/balances';

async function getCurrentParentId() {
  const userId = await getCurrentUserID();
  const parentId = await getParentIdByUserId(userId);

  if (!parentId) {
    notFound();
  }

  return parentId;
}

export async function getCurrentParentBalance() {
  const parentId = await getCurrentParentId();
  try {
    const balance = await getCreditBalanceByParentId(parentId);
    if (!balance) {
      return EMPTY_CREDIT_BALANCE;
    }

    return {
      amount_available: balance.amount_available,
      amount_pending: balance.amount_pending,
    };
  } catch {
    return EMPTY_CREDIT_BALANCE;
  }
}

export async function getCurrentParentCredits() {
  const parentId = await getCurrentParentId();
  try {
    const balance = await getCreditBalanceByParentId(parentId);

    return {
      parentId,
      balance: balance
        ? {
            amount_available: balance.amount_available,
            amount_pending: balance.amount_pending,
          }
        : EMPTY_CREDIT_BALANCE,
    };
  } catch {
    throw new Error('Your credit balance is temporarily unavailable. Please try again in a moment.');
  }
}
