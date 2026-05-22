import 'server-only';
import {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getCompletedSessionDebitRows,
  getDebitTransactionRows,
  getPendingNoteSessionRows,
  getScheduledSessionsCountBetween,
} from '@/db/queries/admin-dashboard';
import { creditsToMinutes, formatHours, minutesToHours, slotUnitsToMinutes } from '@/lib/billing-units';

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
  available_minutes: number;
  available_hours: string;
};

export const AT_RISK_THRESHOLD = 2;
const AT_RISK_THRESHOLD_MINUTES = creditsToMinutes(AT_RISK_THRESHOLD);

export async function getAdminMetrics() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [sessionsTodayRows, pendingNotes, debitTransactions, completedSessionRows, atRiskRows] = await Promise.all([
    getScheduledSessionsCountBetween(startOfToday, endOfToday),
    getPendingNoteSessionRows(),
    getDebitTransactionRows(),
    getCompletedSessionDebitRows(),
    getAtRiskParentCountRows(AT_RISK_THRESHOLD_MINUTES),
  ]);

  const pendingNotesCreditsAtRisk = pendingNotes.reduce(
    (sum, session) => sum + minutesToHours(slotUnitsToMinutes(session.slot_units)),
    0
  );
  const creditsCaptured = debitTransactions.reduce(
    (sum, tx) => sum + minutesToHours(Math.abs(tx.pending_delta_minutes)),
    0
  );
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
    .reduce((sum, session) => sum + minutesToHours(slotUnitsToMinutes(session.slotUnits)), 0);
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

export async function getAtRiskParents() {
  try {
    const rows = await getAtRiskParentRows(AT_RISK_THRESHOLD_MINUTES);

    return rows.map(row => ({
      parent_id: row.parent_id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || '—',
      email: row.email,
      available_minutes: row.available_minutes,
      available_hours: formatHours(minutesToHours(row.available_minutes)),
    }));
  } catch {
    return [];
  }
}

export async function getDebitSessionIds() {
  const rows = await getDebitTransactionRows();

  return new Set(rows.map(tx => tx.session_id).filter(id => id !== null));
}
