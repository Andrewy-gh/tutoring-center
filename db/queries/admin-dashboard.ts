import 'server-only';
import { creditBalances, creditTransactions, parents, sessions, users } from '@/db/schema';
import { and, asc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export async function getScheduledSessionsCountBetween(start: Date, end: Date) {
  const db = await getDb();

  return db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, 'Scheduled'),
        gte(sessions.scheduledAt, start.toISOString()),
        lte(sessions.scheduledAt, end.toISOString())
      )
    );
}

export async function getPendingNoteSessionRows() {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
    })
    .from(sessions)
    .where(eq(sessions.status, 'Pending-Notes'));
}

export async function getPendingNoteSessionRowsSince(start: Date) {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
    })
    .from(sessions)
    .where(and(eq(sessions.status, 'Pending-Notes'), gte(sessions.scheduledAt, start.toISOString())));
}

export async function getDebitTransactionRows() {
  const db = await getDb();

  return db
    .select({
      session_id: creditTransactions.sessionId,
      pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
    })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.type, 'session_debit'), isNotNull(creditTransactions.sessionId)));
}

export async function getDebitTransactionRowsSince(start: Date) {
  const db = await getDb();

  return db
    .select({
      session_id: creditTransactions.sessionId,
      pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.type, 'session_debit'),
        isNotNull(creditTransactions.sessionId),
        gte(creditTransactions.createdAt, start.toISOString())
      )
    );
}

export async function getCompletedSessionDebitRows() {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
      debit_transaction_id: creditTransactions.id,
    })
    .from(sessions)
    .leftJoin(
      creditTransactions,
      and(eq(creditTransactions.sessionId, sessions.id), eq(creditTransactions.type, 'session_debit'))
    )
    .where(eq(sessions.status, 'Completed'));
}

export async function getCompletedSessionDebitRowsSince(start: Date) {
  const db = await getDb();

  return db
    .select({
      id: sessions.id,
      slot_units: sessions.slotUnits,
      debit_transaction_id: creditTransactions.id,
    })
    .from(sessions)
    .leftJoin(
      creditTransactions,
      and(eq(creditTransactions.sessionId, sessions.id), eq(creditTransactions.type, 'session_debit'))
    )
    .where(and(eq(sessions.status, 'Completed'), gte(sessions.scheduledAt, start.toISOString())));
}

export async function getAtRiskParentCountRows(thresholdMinutes: number) {
  const db = await getDb();

  return db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(creditBalances)
    .where(lt(creditBalances.availableMinutes, thresholdMinutes));
}

export async function getAtRiskParentRows(thresholdMinutes: number) {
  const db = await getDb();

  return db
    .select({
      parent_id: parents.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      available_minutes: creditBalances.availableMinutes,
    })
    .from(creditBalances)
    .innerJoin(parents, eq(creditBalances.parentId, parents.id))
    .innerJoin(users, eq(parents.userId, users.id))
    .where(lt(creditBalances.availableMinutes, thresholdMinutes))
    .orderBy(asc(creditBalances.availableMinutes));
}
