import 'server-only';
import {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getCompletedSessionDebitRowsSince,
  getDebitTransactionRows,
  getDebitTransactionRowsSince,
  getPendingNoteSessionRowsSince,
  getScheduledSessionsCountBetween,
} from '@/db/queries/admin-dashboard';
import { creditsToMinutes, formatHours, minutesToHours, slotUnitsToMinutes } from '@/features/credits/billing-units';

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
export const BILLED_SESSIONS_LOOKBACK_DAYS = 30;
const AT_RISK_THRESHOLD_MINUTES = creditsToMinutes(AT_RISK_THRESHOLD);

function getBilledSessionsWindowStart(now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() - BILLED_SESSIONS_LOOKBACK_DAYS);

  return start;
}

export async function getAdminMetrics() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const billedSessionsWindowStart = getBilledSessionsWindowStart(now);

  const [sessionsTodayRows, pendingNotes, debitTransactions, completedSessionRows, atRiskRows] = await Promise.all([
    getScheduledSessionsCountBetween(startOfToday, endOfToday),
    getPendingNoteSessionRowsSince(billedSessionsWindowStart),
    getDebitTransactionRowsSince(billedSessionsWindowStart),
    getCompletedSessionDebitRowsSince(billedSessionsWindowStart),
    getAtRiskParentCountRows(AT_RISK_THRESHOLD_MINUTES),
  ]);

  const pendingNotesCreditsAtRisk = pendingNotes.reduce(
    (sum, session) => sum + minutesToHours(slotUnitsToMinutes(session.slot_units)),
    0
  );
  const capturedSessions = new Map<number, number>();

  for (const row of debitTransactions) {
    if (row.session_id === null) {
      continue;
    }

    const existing = capturedSessions.get(row.session_id);
    if (existing) {
      capturedSessions.set(row.session_id, existing + Math.abs(row.pending_delta_minutes));
      continue;
    }

    capturedSessions.set(row.session_id, Math.abs(row.pending_delta_minutes));
  }

  const creditsCaptured = Array.from(capturedSessions.values()).reduce(
    (sum, minutes) => sum + minutesToHours(minutes),
    0
  );
  const creditsLeaked = completedSessionRows
    .filter(session => session.debit_transaction_id === null)
    .reduce((sum, session) => sum + minutesToHours(slotUnitsToMinutes(session.slot_units)), 0);
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
