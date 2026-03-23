import { CreditBalanceNotFoundError, InsufficientCreditsError } from '@/lib/db/book-session';
import {
  deductCreditBalance,
  getCreditBalanceByParentId,
  type CreditBalanceAmounts,
} from '@/lib/db/queries/credits/balances';

type CreditBalanceRow = CreditBalanceAmounts;

function normalizeError(error: unknown) {
  return error instanceof Error ? error : new Error('Failed to access credit balance');
}

/**
 * Gets the credit balance for a parent
 * @param parent_id: the id of the parent whose balance to retrieve
 * @param database: optional Drizzle db/tx; non-Drizzle values are ignored
 * @returns the amount available and amount pending for the parent, or an error if the query fails
 */
export async function getBalance(parent_id: number, database?: unknown) {
  try {
    const balance = await getCreditBalanceByParentId(parent_id, database);
    return {
      data: balance ? [{ amount_available: balance.amount_available, amount_pending: balance.amount_pending }] : [],
      error: null,
    };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

/**
 * Deduct credits from a parent's balance and add them to the pending amount
 * @param parent_id: The id of the parent whose balance to deduct credits from
 * @param amount: The amount of credits to deduct from the parent's balance
 * @param database: optional Drizzle db/tx; non-Drizzle values are ignored
 * @returns The updated balance for the parent, or an error if the query fails or if the parent has insufficient credits
 */
export async function deductCredits(parent_id: number, amount: number, database?: unknown) {
  try {
    const data = await deductCreditBalance(parent_id, amount, database);

    if (data) {
      return { data, error: null };
    }

    const { data: balance, error } = await getBalance(parent_id, database);
    if (error) {
      return { data: null, error };
    }

    if (!balance || balance.length === 0) {
      return { data: null, error: new CreditBalanceNotFoundError() };
    }

    return { data: null, error: new InsufficientCreditsError() };
  } catch (error) {
    return { data: null, error: normalizeError(error) };
  }
}

export { CreditBalanceNotFoundError, InsufficientCreditsError };
