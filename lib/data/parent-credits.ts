import 'server-only';
import { notFound } from 'next/navigation';
import { getCurrentUserID } from '@/lib/auth';
import { EMPTY_CREDIT_BALANCE } from '@/lib/credit-balances';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import { getBalance } from '@/server/credits';

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
  const { data, error } = await getBalance(parentId);

  if (error || !data?.length) {
    return EMPTY_CREDIT_BALANCE;
  }

  return data[0];
}

export async function getCurrentParentCredits() {
  const parentId = await getCurrentParentId();
  const { data, error } = await getBalance(parentId);

  if (error) {
    throw new Error('Your credit balance is temporarily unavailable. Please try again in a moment.');
  }

  return {
    parentId,
    balance: data?.[0] ?? EMPTY_CREDIT_BALANCE,
  };
}
