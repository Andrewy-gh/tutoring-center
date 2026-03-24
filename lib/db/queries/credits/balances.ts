import 'server-only';
import { sql, type SQL } from 'drizzle-orm';

export type CreditBalanceAmounts = {
  amount_available: number;
  amount_pending: number;
};

export type CreditBalanceRow = CreditBalanceAmounts & {
  parent_id: number;
};

type SqlExecutor = {
  execute<T = unknown>(query: SQL): Promise<T>;
};

function isSqlExecutor(value: unknown): value is SqlExecutor {
  return typeof value === 'object' && value !== null && 'execute' in value && typeof value.execute === 'function';
}

async function getExecutor(database?: unknown) {
  if (isSqlExecutor(database)) {
    return database as SqlExecutor;
  }

  return (await import('@/lib/db/client')).db as unknown as SqlExecutor;
}

export async function getCreditBalanceByParentId(parentId: number, database?: unknown) {
  const db = await getExecutor(database);
  const rows = await db.execute<CreditBalanceRow[]>(sql`
    select parent_id, amount_available, amount_pending
    from credit_balances
    where parent_id = ${parentId}
    limit 1
  `);

  return rows[0] ?? null;
}

export async function upsertCreditBalance(parentId: number, amounts: CreditBalanceAmounts, database?: unknown) {
  const db = await getExecutor(database);
  const rows = await db.execute<CreditBalanceRow[]>(sql`
    insert into credit_balances (
      parent_id,
      amount_available,
      amount_pending
    )
    values (
      ${parentId},
      ${amounts.amount_available},
      ${amounts.amount_pending}
    )
    on conflict (parent_id)
    do update set
      amount_available = ${amounts.amount_available},
      amount_pending = ${amounts.amount_pending},
      updated_at = now()
    returning parent_id, amount_available, amount_pending
  `);

  return rows[0] ?? null;
}

export async function deductCreditBalance(parentId: number, amount: number, database?: unknown) {
  const db = await getExecutor(database);
  const rows = await db.execute<CreditBalanceAmounts[]>(sql`
    update credit_balances
    set
      amount_available = amount_available - ${amount},
      amount_pending = amount_pending + ${amount},
      updated_at = now()
    where parent_id = ${parentId}
      and amount_available >= ${amount}
    returning amount_available, amount_pending
  `);

  return rows[0] ?? null;
}
