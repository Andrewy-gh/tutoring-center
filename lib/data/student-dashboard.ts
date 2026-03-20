import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, isValidRole, type UserRole } from '@/lib/auth';
import { getCreditTransactionSummary, getNetCreditDelta } from '@/lib/credit-ledger';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { creditTransactions, parents, sessionProgress, sessions, type SessionStatus } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';

type AllowedRole = Exclude<UserRole, 'tutor'>;
type CreditTransactionRecord = Pick<
  typeof creditTransactions.$inferSelect,
  'id' | 'createdAt' | 'type' | 'availableDelta' | 'pendingDelta' | 'availableAfter' | 'pendingAfter' | 'sessionId'
>;

export type StudentCreditHistoryItem = {
  id: number;
  created_at: string;
  type: CreditTransactionRecord['type'];
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
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

  const db = await getDb();
  const userId = await getCurrentUserID();

  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  if (!parent) {
    notFound();
  }

  return parent.id;
}

function toLedgerRecord(transaction: CreditTransactionRecord) {
  return {
    id: transaction.id,
    created_at: transaction.createdAt,
    type: transaction.type,
    available_delta: transaction.availableDelta,
    pending_delta: transaction.pendingDelta,
    available_after: transaction.availableAfter,
    pending_after: transaction.pendingAfter,
    session_id: transaction.sessionId,
  };
}

function mapCreditHistoryItem(transaction: CreditTransactionRecord): StudentCreditHistoryItem {
  const ledgerRecord = toLedgerRecord(transaction);

  return {
    ...ledgerRecord,
    net_amount: getNetCreditDelta(ledgerRecord),
    summary: getCreditTransactionSummary(ledgerRecord),
  };
}

export async function getStudentDashboardDetails(studentId: number, role: UserRole): Promise<StudentDashboardDetails> {
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
        createdAt: creditTransactions.createdAt,
        type: creditTransactions.type,
        availableDelta: creditTransactions.availableDelta,
        pendingDelta: creditTransactions.pendingDelta,
        availableAfter: creditTransactions.availableAfter,
        pendingAfter: creditTransactions.pendingAfter,
        sessionId: creditTransactions.sessionId,
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
