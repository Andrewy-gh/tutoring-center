import 'server-only';
import {
  getAtRiskParentCountRows,
  getAtRiskParentRows,
  getBilledDashboardSessionRowsBetween,
  getCompletedSessionDebitRowsBetween,
  getDashboardSessionRowsBetween,
  getDebitTransactionRows,
  getDebitTransactionRowsBetween,
  getPendingBillingDashboardSessionRowsBetween,
  getPendingNoteDashboardSessionRowsBetween,
  getPendingNoteSessionRowsBetween,
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

function getRevenueWindow(now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() - BILLED_SESSIONS_LOOKBACK_DAYS);
  const end = new Date(now);

  return { start, end };
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
  const revenueWindow = getRevenueWindow(now);

  const [sessionsTodayRows, pendingNotes, debitTransactions, completedSessionRows, atRiskRows] = await Promise.all([
    getScheduledSessionsCountBetween(startOfToday, endOfToday),
    getPendingNoteSessionRowsBetween(revenueWindow.start, revenueWindow.end),
    getDebitTransactionRowsBetween(revenueWindow.start, revenueWindow.end),
    getCompletedSessionDebitRowsBetween(revenueWindow.start, revenueWindow.end),
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

export async function getAdminDashboardSessions(view: ViewKey) {
  const now = new Date();
  const { startOfToday, endOfToday } = getTodayRange(now);
  const revenueWindow = getRevenueWindow(now);

  if (view === 'sessions-today') {
    return mapDashboardSessionRows(await getDashboardSessionRowsBetween(startOfToday, endOfToday));
  }

  if (view === 'pending-notes') {
    return mapDashboardSessionRows(
      await getPendingNoteDashboardSessionRowsBetween(revenueWindow.start, revenueWindow.end)
    );
  }

  if (view === 'sessions-billed') {
    return mapDashboardSessionRows(await getBilledDashboardSessionRowsBetween(revenueWindow.start, revenueWindow.end));
  }

  if (view === 'sessions-pending-billing') {
    return mapDashboardSessionRows(
      await getPendingBillingDashboardSessionRowsBetween(revenueWindow.start, revenueWindow.end)
    );
  }

  return [];
}
