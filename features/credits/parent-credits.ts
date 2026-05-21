import 'server-only';
import { notFound } from 'next/navigation';
import { getParentIdByUserId } from '@/db/queries/actors';
import { getCreditBalanceByParentId } from '@/db/queries/credits/balances';
import { EMPTY_CREDIT_BALANCE } from '@/features/credits/credit-balances';
import { getCurrentUserID } from '@/lib/auth';

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
      available_minutes: balance.available_minutes,
      pending_minutes: balance.pending_minutes,
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
            available_minutes: balance.available_minutes,
            pending_minutes: balance.pending_minutes,
          }
        : EMPTY_CREDIT_BALANCE,
    };
  } catch {
    throw new Error('Your credit balance is temporarily unavailable. Please try again in a moment.');
  }
}
