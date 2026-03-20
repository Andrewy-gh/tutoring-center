import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, isValidRole, type UserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { getCreditTransactionSummary, getNetCreditDelta } from '@/lib/credit-ledger';
import type { Enums, Tables } from '@/lib/supabase/database.types';
import { createSupabaseServiceClient } from '@/lib/supabase/serverClient';
type Embedded<T> = T | T[] | null;
type AllowedRole = Exclude<UserRole, 'tutor'>;
type TransactionType = Enums<'transaction_type'>;
type SessionStatus = Enums<'session_status'>;

type CreditTransactionRecord = Pick<
  Tables<'credit_transactions'>,
  | 'id'
  | 'created_at'
  | 'type'
  | 'available_delta'
  | 'pending_delta'
  | 'available_after'
  | 'pending_after'
  | 'session_id'
>;
type SessionProgressJoin = Pick<
  Tables<'session_progress'>,
  'created_at' | 'updated_at' | 'topics' | 'homework_assigned' | 'public_notes'
>;
type ProgressSessionRecord = Pick<Tables<'sessions'>, 'id' | 'scheduled_at' | 'status' | 'subject_id' | 'tutor_id'> & {
  session_progress: Embedded<SessionProgressJoin>;
};

export type StudentCreditHistoryItem = {
  id: number;
  created_at: string;
  type: TransactionType;
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

const CREDIT_HISTORY_SELECT = `
  id,
  created_at,
  type,
  available_delta,
  pending_delta,
  available_after,
  pending_after,
  session_id,
  session:sessions!inner (
    student_id
  )
` as const;

const PROGRESS_REPORT_SELECT = `
  id,
  subject_id,
  tutor_id,
  scheduled_at,
  status,
  session_progress!inner (
    created_at,
    updated_at,
    topics,
    homework_assigned,
    public_notes
  )
` as const;

async function getScopedParentId(role: AllowedRole) {
  if (role !== 'parent') {
    return null;
  }

  const userId = await getCurrentUserID();
  const supabase = createSupabaseServiceClient();
  const { data: parent, error } = await supabase.from('parents').select('id').eq('user_id', userId).single();

  if (error || !parent) {
    notFound();
  }

  return parent.id;
}

function mapCreditHistoryItem(transaction: CreditTransactionRecord): StudentCreditHistoryItem {
  return {
    id: transaction.id,
    created_at: transaction.created_at,
    type: transaction.type,
    available_delta: transaction.available_delta,
    pending_delta: transaction.pending_delta,
    available_after: transaction.available_after,
    pending_after: transaction.pending_after,
    net_amount: getNetCreditDelta(transaction),
    summary: getCreditTransactionSummary(transaction),
    session_id: transaction.session_id,
  };
}

function mapProgressReportItem(
  session: ProgressSessionRecord,
  subjectMap: Map<number, { name: string }>,
  tutorMap: Map<number, { name: string }>
): StudentProgressReportItem | null {
  const progress = Array.isArray(session.session_progress) ? session.session_progress[0] : session.session_progress;

  if (!progress) {
    return null;
  }

  return {
    session_id: session.id,
    scheduled_at: session.scheduled_at,
    status: session.status,
    subject_name: subjectMap.get(session.subject_id)?.name ?? MISSING_VALUE,
    tutor_name: tutorMap.get(session.tutor_id)?.name ?? MISSING_VALUE,
    report_created_at: progress.created_at,
    report_updated_at: progress.updated_at,
    topics: progress.topics,
    homework_assigned: progress.homework_assigned,
    public_notes: progress.public_notes,
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
  const supabase = createSupabaseServiceClient();
  const parentId = await getScopedParentId(allowedRole);

  let creditHistoryQuery = supabase
    .from('credit_transactions')
    .select(CREDIT_HISTORY_SELECT)
    .eq('session.student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(CREDIT_HISTORY_LIMIT);

  let progressReportsQuery = supabase
    .from('sessions')
    .select(PROGRESS_REPORT_SELECT)
    .eq('student_id', studentId)
    .order('scheduled_at', { ascending: false })
    .limit(PROGRESS_REPORT_LIMIT);

  if (parentId !== null) {
    creditHistoryQuery = creditHistoryQuery.eq('parent_id', parentId);
    progressReportsQuery = progressReportsQuery.eq('parent_id', parentId);
  }

  const [{ data: creditHistoryData, error: creditHistoryError }, { data: progressReportsData, error: progressError }] =
    await Promise.all([creditHistoryQuery, progressReportsQuery]);

  if (creditHistoryError) {
    throw new Error('Student credit history is temporarily unavailable. Please try again.');
  }

  if (progressError) {
    throw new Error('Student progress reports are temporarily unavailable. Please try again.');
  }

  const progressReportRows = (progressReportsData ?? []) as ProgressSessionRecord[];
  const subjectMap = await getSubjectMapByIds(progressReportRows.map(item => item.subject_id));
  const tutorMap = await getTutorProfileMapByIds(progressReportRows.map(item => item.tutor_id));

  return {
    creditHistory: (creditHistoryData ?? []).map(item => mapCreditHistoryItem(item as CreditTransactionRecord)),
    progressReports: progressReportRows
      .map(item => mapProgressReportItem(item, subjectMap, tutorMap))
      .filter((item): item is StudentProgressReportItem => item !== null),
  };
}
