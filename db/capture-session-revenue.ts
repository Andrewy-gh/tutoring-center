import 'server-only';
import { slotUnitsToMinutes } from '@/features/credits/billing-units';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

type SqlExecutor = {
  execute(query: SQL): Promise<unknown>;
};

export type CaptureSessionRevenueDatabase = SqlExecutor & {
  transaction<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T>;
};

export type ProgressReportValues = {
  sessionId: number;
  topics: string | null;
  homeworkAssigned: string | null;
  publicNotes: string | null;
  internalNotes: string | null;
  updatedAt: string;
};

export class SessionRevenueCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionRevenueCaptureError';
  }
}

async function getDefaultDatabase() {
  const { db } = await import('./client');

  return {
    execute: query => db.execute(query),
    transaction: callback => db.transaction(callback),
  } satisfies CaptureSessionRevenueDatabase;
}

const ExistingDebitRowsSchema = z.array(z.object({ id: z.number() }));
const SessionRowsSchema = z.array(
  z.object({
    id: z.number(),
    parent_id: z.number(),
    slot_units: z.number(),
  })
);
const BalanceRowsSchema = z.array(
  z.object({
    available_minutes: z.number(),
    pending_minutes: z.number(),
  })
);

async function upsertProgressReport(tx: SqlExecutor, values: ProgressReportValues) {
  await tx.execute(sql`
    insert into session_progress (
      session_id,
      topics,
      homework_assigned,
      public_notes,
      internal_notes,
      updated_at
    )
    values (
      ${values.sessionId},
      ${values.topics},
      ${values.homeworkAssigned},
      ${values.publicNotes},
      ${values.internalNotes},
      ${values.updatedAt}::timestamptz
    )
    on conflict (session_id) do update
    set
      topics = excluded.topics,
      homework_assigned = excluded.homework_assigned,
      public_notes = excluded.public_notes,
      internal_notes = excluded.internal_notes,
      updated_at = excluded.updated_at
  `);
}

async function captureSessionRevenue(tx: SqlExecutor, sessionId: number) {
  const idempotencyKey = `session_debit:${sessionId}`;
  const [session] = SessionRowsSchema.parse(
    await tx.execute(sql`
    select id, parent_id, slot_units
    from sessions
    where id = ${sessionId}
    for update
  `)
  );

  if (!session) {
    throw new SessionRevenueCaptureError('Session does not exist');
  }

  if (session.slot_units <= 0) {
    throw new SessionRevenueCaptureError('Session duration must be positive');
  }

  const existingDebit = ExistingDebitRowsSchema.parse(
    await tx.execute(sql`
    select id
    from credit_transactions
    where idempotency_key = ${idempotencyKey}
    limit 1
  `)
  );

  if (existingDebit.length > 0) {
    return false;
  }

  const sessionMinutes = slotUnitsToMinutes(session.slot_units);
  const [balance] = BalanceRowsSchema.parse(
    await tx.execute(sql`
    update credit_balances
    set
      pending_minutes = pending_minutes - ${sessionMinutes},
      updated_at = now()
    where parent_id = ${session.parent_id}
      and pending_minutes >= ${sessionMinutes}
    returning available_minutes, pending_minutes
  `)
  );

  if (!balance) {
    throw new SessionRevenueCaptureError('Reserved credits are not available for this session');
  }

  await tx.execute(sql`
    insert into credit_transactions (
      parent_id,
      session_id,
      available_delta_minutes,
      pending_delta_minutes,
      available_after_minutes,
      pending_after_minutes,
      idempotency_key,
      type
    )
    values (
      ${session.parent_id},
      ${session.id},
      0,
      ${sessionMinutes * -1},
      ${balance.available_minutes},
      ${balance.pending_minutes},
      ${idempotencyKey},
      'session_debit'
    )
  `);

  await tx.execute(sql`
    update sessions
    set status = 'Completed', updated_at = now()
    where id = ${session.id}
  `);

  return true;
}

export async function saveProgressReportAndCaptureRevenue(
  values: ProgressReportValues,
  database?: CaptureSessionRevenueDatabase
) {
  const revenueDatabase = database ?? (await getDefaultDatabase());

  return revenueDatabase.transaction(async tx => {
    await upsertProgressReport(tx, values);
    const captured = await captureSessionRevenue(tx, values.sessionId);

    return { captured };
  });
}
