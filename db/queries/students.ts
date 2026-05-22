import 'server-only';
import { creditTransactions, sessionProgress, sessions } from '@/db/schema';
import type { CreditTransactionRecord, SessionStatus } from '@/db/types';
import { and, desc, eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export type StudentDashboardCreditHistoryRow = Pick<
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

export type StudentDashboardProgressReportRow = {
  session_id: number;
  subject_id: number;
  tutor_id: number;
  scheduled_at: string;
  status: SessionStatus;
  report_created_at: string;
  report_updated_at: string;
  topics: string | null;
  homework_assigned: string | null;
  public_notes: string | null;
};

type StudentDashboardQueryScope = {
  studentId: number;
  parentId: number | null;
  limit: number;
};

export async function getStudentDashboardCreditHistoryRows({ studentId, parentId, limit }: StudentDashboardQueryScope) {
  const db = await getDb();
  const filters = [eq(sessions.studentId, studentId)];

  if (parentId !== null) {
    filters.push(eq(creditTransactions.parentId, parentId));
  }

  return db
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
    .where(and(...filters))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
}

export async function getStudentDashboardProgressReportRows({
  studentId,
  parentId,
  limit,
}: StudentDashboardQueryScope) {
  const db = await getDb();
  const filters = [eq(sessions.studentId, studentId)];

  if (parentId !== null) {
    filters.push(eq(sessions.parentId, parentId));
  }

  return db
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
    .where(and(...filters))
    .orderBy(desc(sessions.scheduledAt))
    .limit(limit);
}
