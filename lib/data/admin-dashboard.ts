import 'server-only';
import { creditBalances, creditTransactions, parents, sessions, users } from '@/lib/db/schema';
import { and, asc, eq, gte, isNotNull, lt, lte, sql } from 'drizzle-orm';

export type AdminMetrics = {
  sessionsTodayCount: number;
  pendingNotesCount: number;
  pendingNotesCreditsAtRisk: number;
  atRiskParentsCount: number;
  creditsCaptured: number;
  creditsLeaked: number;
  leakageRate: number;
};

export type AtRiskParent = {
  parent_id: number;
  name: string;
  email: string;
  amount_available: number;
};

export const AT_RISK_THRESHOLD = 2;

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = await getDb();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [sessionsTodayRows, pendingNotes, debitTransactions, completedSessionRows, atRiskRows] = await Promise.all([
    db
      .select({
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.status, 'Scheduled'),
          gte(sessions.scheduledAt, startOfToday.toISOString()),
          lte(sessions.scheduledAt, endOfToday.toISOString())
        )
      ),
    db
      .select({
        id: sessions.id,
        slot_units: sessions.slotUnits,
      })
      .from(sessions)
      .where(eq(sessions.status, 'Pending-Notes')),
    db
      .select({
        pending_delta: creditTransactions.pendingDelta,
      })
      .from(creditTransactions)
      .where(and(eq(creditTransactions.type, 'session_debit'), isNotNull(creditTransactions.sessionId))),
    db
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
      .where(eq(sessions.status, 'Completed')),
    db
      .select({
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(creditBalances)
      .where(lt(creditBalances.amountAvailable, AT_RISK_THRESHOLD)),
  ]);

  const pendingNotesCreditsAtRisk = pendingNotes.reduce((sum, session) => sum + session.slot_units, 0);
  const creditsCaptured = debitTransactions.reduce((sum, tx) => sum + Math.abs(tx.pending_delta), 0);
  const completedSessions = new Map<number, { slotUnits: number; hasDebit: boolean }>();

  for (const row of completedSessionRows) {
    const existing = completedSessions.get(row.id);
    if (existing) {
      existing.hasDebit ||= row.debit_transaction_id !== null;
      continue;
    }

    completedSessions.set(row.id, {
      slotUnits: row.slot_units,
      hasDebit: row.debit_transaction_id !== null,
    });
  }

  const creditsLeaked = Array.from(completedSessions.values())
    .filter(session => !session.hasDebit)
    .reduce((sum, session) => sum + session.slotUnits, 0);
  const leakageRate = creditsCaptured + creditsLeaked > 0 ? creditsLeaked / (creditsCaptured + creditsLeaked) : 0;

  return {
    sessionsTodayCount: sessionsTodayRows[0]?.count ?? 0,
    pendingNotesCount: pendingNotes.length,
    pendingNotesCreditsAtRisk,
    atRiskParentsCount: atRiskRows[0]?.count ?? 0,
    creditsCaptured,
    creditsLeaked,
    leakageRate,
  };
}

export async function getAtRiskParents(): Promise<AtRiskParent[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select({
        parent_id: parents.id,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        amount_available: creditBalances.amountAvailable,
      })
      .from(creditBalances)
      .innerJoin(parents, eq(creditBalances.parentId, parents.id))
      .innerJoin(users, eq(parents.userId, users.id))
      .where(lt(creditBalances.amountAvailable, AT_RISK_THRESHOLD))
      .orderBy(asc(creditBalances.amountAvailable));

    return rows.map(row => ({
      parent_id: row.parent_id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || '—',
      email: row.email,
      amount_available: row.amount_available,
    }));
  } catch {
    return [];
  }
}

export async function getDebitSessionIds(): Promise<Set<number>> {
  const db = await getDb();
  const rows = await db
    .select({
      session_id: creditTransactions.sessionId,
    })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.type, 'session_debit'), isNotNull(creditTransactions.sessionId)));

  return new Set(rows.map(tx => tx.session_id).filter((id): id is number => id !== null));
}
