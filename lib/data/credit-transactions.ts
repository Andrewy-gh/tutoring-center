import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, type UserRole } from '@/lib/auth';
import { getNetCreditDelta } from '@/lib/credit-ledger';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import { buildCreditTransactionFilters, getCreditTransactionRows } from '@/lib/db/queries/credits/transactions';
import { creditTransactions, parents, sessions, students, users } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type CreditTransactionStudent = {
  id: number;
  name: string;
  email: string;
  phone: string;
  grade: string;
};

type CreditTransactionSession = {
  id: number;
  scheduled_at: string;
  ends_at: string;
  status: typeof sessions.$inferSelect.status;
  subject_name: string;
  tutor_name: string;
};

export type CreditTransactionRow = {
  id: number;
  created_at: string;
  type: typeof creditTransactions.$inferSelect.type;
  available_delta_minutes: number;
  pending_delta_minutes: number;
  available_after_minutes: number;
  pending_after_minutes: number;
  net_amount: number;
  parent_name: string;
  student_name: string;
  session_id: number | null;
};

export type CreditTransactionDetail = {
  id: number;
  created_at: string;
  type: typeof creditTransactions.$inferSelect.type;
  available_delta_minutes: number;
  pending_delta_minutes: number;
  available_after_minutes: number;
  pending_after_minutes: number;
  net_amount: number;
  session_id: number | null;
  note: string | null;
  parent: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  student: CreditTransactionStudent | null;
  session: CreditTransactionSession | null;
};

const MISSING_VALUE = '\u2014';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

function getDisplayName(firstName: string | null | undefined, lastName: string | null | undefined) {
  return [firstName, lastName].filter(Boolean).join(' ') || MISSING_VALUE;
}

function getEmail(email: string | null | undefined) {
  return email ?? MISSING_VALUE;
}

function getPhone(phone: string | null | undefined) {
  return phone ?? MISSING_VALUE;
}

async function getCurrentParentId() {
  const userId = await getCurrentUserID();
  const parentId = await getParentIdByUserId(userId);

  if (!parentId) {
    notFound();
  }

  return parentId;
}

function mapTransactionStudent(row: {
  student_id: number | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_email: string | null;
  student_phone: string | null;
  student_grade: string | null;
}) {
  if (!row.student_id) {
    return null;
  }

  return {
    id: row.student_id,
    name: getDisplayName(row.student_first_name, row.student_last_name),
    email: getEmail(row.student_email),
    phone: getPhone(row.student_phone),
    grade: row.student_grade ?? MISSING_VALUE,
  };
}

function mapTransactionRow(row: {
  id: number;
  created_at: string;
  type: typeof creditTransactions.$inferSelect.type;
  available_delta_minutes: number;
  pending_delta_minutes: number;
  available_after_minutes: number;
  pending_after_minutes: number;
  session_id: number | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  student_id: number | null;
  student_first_name: string | null;
  student_last_name: string | null;
}) {
  return {
    id: row.id,
    created_at: row.created_at,
    type: row.type,
    available_delta_minutes: row.available_delta_minutes,
    pending_delta_minutes: row.pending_delta_minutes,
    available_after_minutes: row.available_after_minutes,
    pending_after_minutes: row.pending_after_minutes,
    net_amount: getNetCreditDelta(row),
    parent_name: getDisplayName(row.parent_first_name, row.parent_last_name),
    student_name: getDisplayName(row.student_first_name, row.student_last_name),
    session_id: row.session_id,
  };
}

export async function getCreditTransactions(role: UserRole) {
  if (role === 'tutor') {
    forbidden();
  }

  const parentId = role === 'parent' ? await getCurrentParentId() : null;
  const rows = await getCreditTransactionRows(
    buildCreditTransactionFilters({
      parentId: parentId ?? undefined,
      type: 'all',
    })
  );

  return rows.map(mapTransactionRow);
}

export async function getCreditTransaction(id: number, role: UserRole) {
  if (role === 'tutor') {
    forbidden();
  }

  if (Number.isNaN(id)) {
    notFound();
  }

  const parentId = role === 'parent' ? await getCurrentParentId() : null;
  const db = await getDb();
  const parentUsers = alias(users, 'credit_tx_detail_parent_users');
  const studentUsers = alias(users, 'credit_tx_detail_student_users');
  const filters = [eq(creditTransactions.id, id)];

  if (parentId !== null) {
    filters.push(eq(creditTransactions.parentId, parentId));
  }

  const rows = await db
    .select({
      id: creditTransactions.id,
      created_at: creditTransactions.createdAt,
      type: creditTransactions.type,
      available_delta_minutes: creditTransactions.availableDeltaMinutes,
      pending_delta_minutes: creditTransactions.pendingDeltaMinutes,
      available_after_minutes: creditTransactions.availableAfterMinutes,
      pending_after_minutes: creditTransactions.pendingAfterMinutes,
      session_id: creditTransactions.sessionId,
      note: creditTransactions.note,
      parent_id: parents.id,
      parent_first_name: parentUsers.firstName,
      parent_last_name: parentUsers.lastName,
      parent_email: parentUsers.email,
      parent_phone: parentUsers.phone,
      session_subject_id: sessions.subjectId,
      session_tutor_id: sessions.tutorId,
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
      student_id: students.id,
      student_first_name: studentUsers.firstName,
      student_last_name: studentUsers.lastName,
      student_email: studentUsers.email,
      student_phone: studentUsers.phone,
      student_grade: students.grade,
    })
    .from(creditTransactions)
    .innerJoin(parents, eq(creditTransactions.parentId, parents.id))
    .innerJoin(parentUsers, eq(parents.userId, parentUsers.id))
    .leftJoin(sessions, eq(creditTransactions.sessionId, sessions.id))
    .leftJoin(students, eq(sessions.studentId, students.id))
    .leftJoin(studentUsers, eq(students.userId, studentUsers.id))
    .where(and(...filters))
    .limit(1);

  const transaction = rows[0];
  if (!transaction) {
    notFound();
  }

  const detail = transaction;

  const subjectMap = await getSubjectMapByIds(detail.session_subject_id ? [detail.session_subject_id] : []);
  const tutorMap = await getTutorProfileMapByIds(detail.session_tutor_id ? [detail.session_tutor_id] : []);

  return {
    id: detail.id,
    created_at: detail.created_at,
    type: detail.type,
    available_delta_minutes: detail.available_delta_minutes,
    pending_delta_minutes: detail.pending_delta_minutes,
    available_after_minutes: detail.available_after_minutes,
    pending_after_minutes: detail.pending_after_minutes,
    net_amount: getNetCreditDelta(detail),
    session_id: detail.session_id,
    note: detail.note,
    parent: {
      id: detail.parent_id,
      name: getDisplayName(detail.parent_first_name, detail.parent_last_name),
      email: getEmail(detail.parent_email),
      phone: getPhone(detail.parent_phone),
    },
    student: mapTransactionStudent(detail),
    session:
      detail.session_id && detail.session_subject_id && detail.session_tutor_id
        ? {
            id: detail.session_id,
            scheduled_at: detail.scheduled_at!,
            ends_at: detail.ends_at!,
            status: detail.status!,
            subject_name: subjectMap.get(detail.session_subject_id)?.name ?? MISSING_VALUE,
            tutor_name: tutorMap.get(detail.session_tutor_id)?.name ?? MISSING_VALUE,
          }
        : null,
  };
}
