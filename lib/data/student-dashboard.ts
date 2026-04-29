import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, isValidRole, type UserRole } from '@/lib/auth';
import { getCreditTransactionSummary, getNetCreditDelta } from '@/lib/credit-ledger';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import { creditTransactions, sessionProgress, sessions } from '@/lib/db/schema';
import type { CreditTransactionRecord, SessionStatus } from '@/lib/db/types';
import { and, desc, eq } from 'drizzle-orm';

type AllowedRole = Exclude<UserRole, 'tutor'>;
type CreditHistoryRow = Pick<
  CreditTransactionRecord,
  | 'id'
  | 'created_at'
  | 'type'
  | 'available_delta_minutes'
  | 'pending_delta_minutes'
  | 'available_after_minutes'
  | 'pending_after_minutes'
  | 'session_id'
>;

export type StudentCreditHistoryItem = {
  id: number;
  created_at: string;
  type: CreditHistoryRow['type'];
  available_delta_minutes: number;
  pending_delta_minutes: number;
  available_after_minutes: number;
  pending_after_minutes: number;
  net_amount: number;
  summary: string;
  session_id: number | null;
};

export type StudentProgressReportItem = {
  session_id: number;
  scheduled_at: string;
  status: SessionStatus;
  subject_name: string;
  tutor_name: string;
  report_created_at: string;
  report_updated_at: string;
  topics: string | null;
  homework_assigned: string | null;
  public_notes: string | null;
};

export type StudentDashboardDetails = {
  creditHistory: StudentCreditHistoryItem[];
  progressReports: StudentProgressReportItem[];
};

const MISSING_VALUE = '\u2014';
const CREDIT_HISTORY_LIMIT = 5;
const PROGRESS_REPORT_LIMIT = 5;

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

async function getScopedParentId(role: AllowedRole) {
  if (role !== 'parent') {
    return null;
  }

  const userId = await getCurrentUserID();
  const parentId = await getParentIdByUserId(userId);

  if (!parentId) {
    notFound();
  }

  return parentId;
}

function mapCreditHistoryItem(transaction: CreditHistoryRow) {
  return {
    ...transaction,
    net_amount: getNetCreditDelta(transaction),
    summary: getCreditTransactionSummary(transaction),
  };
}

export async function getStudentDashboardDetails(studentId: number, role: UserRole) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch student dashboard data.');
  }

  if (role === 'tutor') {
    forbidden();
  }

  if (Number.isNaN(studentId)) {
    notFound();
  }

  const allowedRole: AllowedRole = role;
  const parentId = await getScopedParentId(allowedRole);
  const db = await getDb();

  const creditHistoryWhere = [eq(sessions.studentId, studentId)];
  const progressReportsWhere = [eq(sessions.studentId, studentId)];

  if (parentId !== null) {
    creditHistoryWhere.push(eq(creditTransactions.parentId, parentId));
    progressReportsWhere.push(eq(sessions.parentId, parentId));
  }

  const [creditHistoryRows, progressReportRows] = await Promise.all([
    db
      .select({
        id: creditTransactions.id,
        created_at: creditTransactions.createdAt,
        type: creditTransactions.type,
        available_delta_minutes: creditTransactions.availableDeltaMinutes,
        pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
        available_after_minutes: creditTransactions.availableAfterMinutes,
        pending_after_minutes: creditTransactions.pendingAfterMinutes,
        session_id: creditTransactions.sessionId,
      })
      .from(creditTransactions)
      .innerJoin(sessions, eq(creditTransactions.sessionId, sessions.id))
      .where(and(...creditHistoryWhere))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(CREDIT_HISTORY_LIMIT),
    db
      .select({
        session_id: sessions.id,
        subject_id: sessions.subjectId,
        tutor_id: sessions.tutorId,
        scheduled_at: sessions.scheduledAt,
        status: sessions.status,
        report_created_at: sessionProgress.createdAt,
        report_updated_at: sessionProgress.updatedAt,
        topics: sessionProgress.topics,
        homework_assigned: sessionProgress.homeworkAssigned,
        public_notes: sessionProgress.publicNotes,
      })
      .from(sessions)
      .innerJoin(sessionProgress, eq(sessionProgress.sessionId, sessions.id))
      .where(and(...progressReportsWhere))
      .orderBy(desc(sessions.scheduledAt))
      .limit(PROGRESS_REPORT_LIMIT),
  ]);

  const subjectMap = await getSubjectMapByIds(progressReportRows.map(item => item.subject_id));
  const tutorMap = await getTutorProfileMapByIds(progressReportRows.map(item => item.tutor_id));

  return {
    creditHistory: creditHistoryRows.map(mapCreditHistoryItem),
    progressReports: progressReportRows.map(item => ({
      session_id: item.session_id,
      scheduled_at: item.scheduled_at,
      status: item.status,
      subject_name: subjectMap.get(item.subject_id)?.name ?? MISSING_VALUE,
      tutor_name: tutorMap.get(item.tutor_id)?.name ?? MISSING_VALUE,
      report_created_at: item.report_created_at,
      report_updated_at: item.report_updated_at,
      topics: item.topics,
      homework_assigned: item.homework_assigned,
      public_notes: item.public_notes,
    })),
  };
}
