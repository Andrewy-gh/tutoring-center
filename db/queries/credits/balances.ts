import 'server-only';
import { sql, type SQL } from 'drizzle-orm';

export type CreditBalanceAmounts = {
  available_minutes: number;
  pending_minutes: number;
};

export type CreditBalanceRow = CreditBalanceAmounts & {
  parent_id: number;
};

type SqlExecutor = {
  execute<T = unknown>(query: SQL): Promise<T>;
};

async function getExecutor(database?: SqlExecutor) {
  if (database) {
    return database;
  }

  return (await import('@/db/client')).db as unknown as SqlExecutor;
}

export async function getCreditBalanceByParentId(parentId: number, database?: SqlExecutor) {
  const db = await getExecutor(database);
  const rows = await db.execute<CreditBalanceRow[]>(sql`
    select parent_id, available_minutes, pending_minutes
    from credit_balances
    where parent_id = ${parentId}
    limit 1
  `);

  return rows[0] ?? null;
}

export async function upsertCreditBalance(parentId: number, amounts: CreditBalanceAmounts, database?: SqlExecutor) {
  const db = await getExecutor(database);
  const rows = await db.execute<CreditBalanceRow[]>(sql`
    insert into credit_balances (
      parent_id,
      available_minutes,
      pending_minutes
    )
    values (
      ${parentId},
      ${amounts.available_minutes},
      ${amounts.pending_minutes}
    )
    on conflict (parent_id)
    do update set
      available_minutes = ${amounts.available_minutes},
      pending_minutes = ${amounts.pending_minutes},
      updated_at = now()
    returning parent_id, available_minutes, pending_minutes
  `);

  return rows[0] ?? null;
}

export async function deductCreditBalance(parentId: number, amount: number, database?: SqlExecutor) {
  const db = await getExecutor(database);
  const rows = await db.execute<CreditBalanceAmounts[]>(sql`
    update credit_balances
    set
      available_minutes = available_minutes - ${amount},
      pending_minutes = pending_minutes + ${amount},
      updated_at = now()
    where parent_id = ${parentId}
      and available_minutes >= ${amount}
    returning available_minutes, pending_minutes
  `);

  return rows[0] ?? null;
}
