import { CreditBalanceNotFoundError, InsufficientCreditsError } from '@/lib/db/book-session';
import { sql, type SQL } from 'drizzle-orm';

type CreditBalanceRow = {
  amount_available: number;
  amount_pending: number;
};

type SqlExecutor = {
  execute(query: SQL): Promise<unknown>;
};

function isSqlExecutor(value: unknown): value is SqlExecutor {
  return typeof value === 'object' && value !== null && 'execute' in value && typeof value.execute === 'function';
}

function resolveDatabase(database?: unknown): SqlExecutor | null {
  return isSqlExecutor(database) ? database : null;
}

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
  const client = resolveDatabase(database) ?? (await import('@/lib/db/client')).db;

  try {
    const data = await client.execute(sql`
      select amount_available, amount_pending
      from credit_balances
      where parent_id = ${parent_id}
    `);

    return { data: data as CreditBalanceRow[], error: null };
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
  const client = resolveDatabase(database) ?? (await import('@/lib/db/client')).db;

  try {
    const [data] = (await client.execute(sql`
      update credit_balances
      set
        amount_available = amount_available - ${amount},
        amount_pending = amount_pending + ${amount},
        updated_at = now()
      where parent_id = ${parent_id}
        and amount_available >= ${amount}
      returning amount_available, amount_pending
    `)) as CreditBalanceRow[];

    if (data) {
      return { data, error: null };
    }

    const { data: balance, error } = await getBalance(parent_id, client);
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
