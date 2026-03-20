import 'server-only';
import { notFound } from 'next/navigation';
import { getCurrentUserID } from '@/lib/auth';
import { EMPTY_CREDIT_BALANCE } from '@/lib/credit-balances';
import { parents } from '@/lib/db/schema';
import { getBalance } from '@/server/credits';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

async function getCurrentParentId() {
  const userId = await getCurrentUserID();
  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  if (!parent) {
    notFound();
  }

  return parent.id;
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
