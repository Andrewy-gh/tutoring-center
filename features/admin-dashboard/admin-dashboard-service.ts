import 'server-only';
import {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getBilledDashboardSessionRowsSince,
  getCompletedSessionDebitRows,
  getDashboardSessionRowsBetween,
  getDebitTransactionRows,
  getDebitTransactionRowsSince,
  getPendingBillingDashboardSessionRows,
  getPendingNoteDashboardSessionRows,
  getPendingNoteSessionRows,
  getScheduledSessionsCountBetween,
} from '@/db/queries/admin-dashboard';
import { parseSessionListRows } from '@/db/queries/sessions/list';
import { creditsToMinutes, formatHours, minutesToHours, slotUnitsToMinutes } from '@/features/credits/billing-units';
import type { SessionRow } from '@/features/sessions/sessions-service';
import { getSubjectMapByIds } from '@/features/subjects/subjects-service';
import { getTutorProfileMapByIds } from '@/features/tutors/tutors-service';
import type { ViewKey } from './admin-dashboard-views';

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

function getTodayRange(now: Date) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  return { startOfToday, endOfToday };
}

function getBilledSessionsWindowStart(now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() - BILLED_SESSIONS_LOOKBACK_DAYS);

  return start;
}

async function mapDashboardSessionRows(rows: Awaited<ReturnType<typeof getDashboardSessionRowsBetween>>) {
  const parsedSessions = parseSessionListRows(rows);
  if (!parsedSessions.success) {
    throw new Error('Admin dashboard session data format is invalid. Please try again later.');
  }

  const subjectMap = await getSubjectMapByIds(parsedSessions.data.map(session => session.subject_id));
  const tutorMap = await getTutorProfileMapByIds(parsedSessions.data.map(session => session.tutor_id));

  return parsedSessions.data.map<SessionRow>(session => {
    const tutor = tutorMap.get(session.tutor_id) ?? { name: '—', email: '' };
    const subjectName = subjectMap.get(session.subject_id)?.name ?? 'Unknown';

    return {
      id: session.id,
      student_name: [session.student_first_name, session.student_last_name].filter(Boolean).join(' ') || '—',
      tutor_id: session.tutor_id,
      tutor_name: tutor.name,
      tutor_email: tutor.email,
      student_id: session.student_id,
      subject_id: session.subject_id,
      subject_name: subjectName,
      scheduled_at: session.scheduled_at,
      ends_at: session.ends_at,
      hours: slotUnitsToMinutes(session.slot_units) / 60,
      status: session.status,
    };
  });
}

export async function getAdminMetrics() {
  const now = new Date();
  const { startOfToday, endOfToday } = getTodayRange(now);
  const billedSessionsWindowStart = getBilledSessionsWindowStart(now);

  const [sessionsTodayRows, pendingNotes, debitTransactions, completedSessionRows, atRiskRows] = await Promise.all([
    getScheduledSessionsCountBetween(startOfToday, endOfToday),
    getPendingNoteSessionRows(),
    getDebitTransactionRowsSince(billedSessionsWindowStart),
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

export async function getAdminDashboardSessions(view: ViewKey) {
  const now = new Date();
  const { startOfToday, endOfToday } = getTodayRange(now);

  if (view === 'sessions-today') {
    return mapDashboardSessionRows(await getDashboardSessionRowsBetween(startOfToday, endOfToday));
  }

  if (view === 'pending-notes') {
    return mapDashboardSessionRows(await getPendingNoteDashboardSessionRows());
  }

  if (view === 'sessions-billed') {
    return mapDashboardSessionRows(await getBilledDashboardSessionRowsSince(getBilledSessionsWindowStart(now)));
  }

  if (view === 'sessions-pending-billing') {
    return mapDashboardSessionRows(await getPendingBillingDashboardSessionRows());
  }

  return [];
}
