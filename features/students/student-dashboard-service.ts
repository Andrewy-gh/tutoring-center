import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getParentIdByUserId } from '@/db/queries/actors';
import {
  getStudentDashboardCreditHistoryRows,
  getStudentDashboardProgressReportRows,
  type StudentDashboardCreditHistoryRow,
} from '@/db/queries/students';
import { getCreditTransactionSummary, getNetCreditDelta } from '@/features/credits/credit-ledger';
import { getTutorProfileMapByIds } from '@/features/tutors/tutors-service';
import { getCurrentUserID, type UserRole } from '@/lib/auth';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import type { SessionStatus } from '@/lib/validators/sessions';

type AllowedRole = Exclude<UserRole, 'tutor'>;

export type StudentCreditHistoryItem = {
  id: number;
  created_at: string;
  type: StudentDashboardCreditHistoryRow['type'];
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

const MISSING_VALUE = '—';
const CREDIT_HISTORY_LIMIT = 5;
const PROGRESS_REPORT_LIMIT = 5;

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

function assertStudentDashboardRole(role: UserRole) {
  if (role === 'admin' || role === 'parent') {
    return role;
  }

  if (role === 'tutor') {
    forbidden();
  }

  throw new Error('Role is required to fetch student dashboard data.');
}

function mapCreditHistoryItem(transaction: StudentDashboardCreditHistoryRow) {
  return {
    ...transaction,
    net_amount: getNetCreditDelta(transaction),
    summary: getCreditTransactionSummary(transaction),
  };
}

export async function getStudentDashboardDetails(studentId: number, role: UserRole): Promise<StudentDashboardDetails> {
  const allowedRole = assertStudentDashboardRole(role);

  if (Number.isNaN(studentId)) {
    notFound();
  }

  const parentId = await getScopedParentId(allowedRole);
  const [creditHistoryRows, progressReportRows] = await Promise.all([
    getStudentDashboardCreditHistoryRows({
      studentId,
      parentId,
      limit: CREDIT_HISTORY_LIMIT,
    }),
    getStudentDashboardProgressReportRows({
      studentId,
      parentId,
      limit: PROGRESS_REPORT_LIMIT,
    }),
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

export const studentDashboardDataService = {
  getStudentDashboardDetails,
};
