import 'server-only';
import { creditTransactions, parents, sessions, students, users } from '@/lib/db/schema';
import { TransactionsWithJoinsListSchema, type TransactionsWithJoins } from '@/lib/validators/transactions';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export type CreditTransactionListFilters = {
  parentId?: number;
  studentId?: number;
  sessionId?: number;
  type?: typeof creditTransactions.$inferSelect.type | 'all';
  startDate?: string;
  endDate?: string;
};

export type CreditTransactionJoinRow = {
  id: number;
  parent_id: number;
  session_id: number | null;
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
  type: typeof creditTransactions.$inferSelect.type;
  created_at: string;
  idempotency_key: string | null;
  note: string | null;
  parent_first_name: string | null;
  parent_last_name: string | null;
  session_subject_id: number | null;
  session_tutor_id: number | null;
  scheduled_at: string | null;
  ends_at: string | null;
  status: typeof sessions.$inferSelect.status | null;
  student_id: number | null;
  student_user_id: number | null;
  student_grade: string | null;
  student_first_name: string | null;
  student_last_name: string | null;
  student_email: string | null;
  student_phone: string | null;
};

export type CreditTransactionInsertInput = {
  parent_id: number;
  session_id: number | null;
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
  idempotency_key?: string | null;
  note?: string | null;
  type: typeof creditTransactions.$inferSelect.type;
};

export type CreditTransactionInsertRow = {
  id: number;
  parent_id: number;
  session_id: number | null;
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
  idempotency_key: string | null;
  note: string | null;
  type: typeof creditTransactions.$inferSelect.type;
  created_at: string;
};

export function buildCreditTransactionFilters({
  parentId,
  studentId,
  sessionId,
  type,
  startDate,
  endDate,
}: CreditTransactionListFilters) {
  const filters = [];

  if (parentId) filters.push(eq(creditTransactions.parentId, parentId));
  if (studentId) filters.push(eq(sessions.studentId, studentId));
  if (sessionId) filters.push(eq(creditTransactions.sessionId, sessionId));
  if (type && type !== 'all') filters.push(eq(creditTransactions.type, type));
  if (startDate) filters.push(gte(creditTransactions.createdAt, startDate));
  if (endDate) filters.push(lte(creditTransactions.createdAt, endDate));

  return filters;
}

export async function getCreditTransactionCount(filters: ReturnType<typeof buildCreditTransactionFilters>) {
  const db = await getDb();
  const rows = await db
    .select({
      count: sql<number>`cast(count(distinct ${creditTransactions.id}) as int)`,
    })
    .from(creditTransactions)
    .leftJoin(sessions, eq(creditTransactions.sessionId, sessions.id))
    .where(filters.length === 0 ? undefined : and(...filters));

  return rows[0]?.count ?? 0;
}

export async function getCreditTransactionRows(
  filters: ReturnType<typeof buildCreditTransactionFilters>,
  options?: {
    from?: number;
    pageSize?: number;
  }
) {
  const db = await getDb();
  const parentUsers = alias(users, 'credit_tx_parent_users');
  const studentUsers = alias(users, 'credit_tx_student_users');

  const query = db
    .select({
      id: creditTransactions.id,
      parent_id: creditTransactions.parentId,
      session_id: creditTransactions.sessionId,
      available_delta: creditTransactions.availableDelta,
      pending_delta: creditTransactions.pendingDelta,
      available_after: creditTransactions.availableAfter,
      pending_after: creditTransactions.pendingAfter,
      type: creditTransactions.type,
      created_at: creditTransactions.createdAt,
      idempotency_key: creditTransactions.idempotencyKey,
      note: creditTransactions.note,
      parent_first_name: parentUsers.firstName,
      parent_last_name: parentUsers.lastName,
      session_subject_id: sessions.subjectId,
      session_tutor_id: sessions.tutorId,
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
      student_id: students.id,
      student_user_id: students.userId,
      student_grade: students.grade,
      student_first_name: studentUsers.firstName,
      student_last_name: studentUsers.lastName,
      student_email: studentUsers.email,
      student_phone: studentUsers.phone,
    })
    .from(creditTransactions)
    .innerJoin(parents, eq(creditTransactions.parentId, parents.id))
    .innerJoin(parentUsers, eq(parents.userId, parentUsers.id))
    .leftJoin(sessions, eq(creditTransactions.sessionId, sessions.id))
    .leftJoin(students, eq(sessions.studentId, students.id))
    .leftJoin(studentUsers, eq(students.userId, studentUsers.id))
    .where(filters.length === 0 ? undefined : and(...filters))
    .orderBy(desc(creditTransactions.createdAt));

  if (options?.pageSize !== undefined) {
    return query.limit(options.pageSize).offset(options.from ?? 0);
  }

  return query;
}

export async function createCreditTransaction(input: CreditTransactionInsertInput) {
  const db = await getDb();
  const [transaction] = await db
    .insert(creditTransactions)
    .values({
      parentId: input.parent_id,
      sessionId: input.session_id,
      availableDelta: input.available_delta,
      pendingDelta: input.pending_delta,
      availableAfter: input.available_after,
      pendingAfter: input.pending_after,
      idempotencyKey: input.idempotency_key,
      note: input.note,
      type: input.type,
    })
    .returning({
      id: creditTransactions.id,
      parent_id: creditTransactions.parentId,
      session_id: creditTransactions.sessionId,
      available_delta: creditTransactions.availableDelta,
      pending_delta: creditTransactions.pendingDelta,
      available_after: creditTransactions.availableAfter,
      pending_after: creditTransactions.pendingAfter,
      idempotency_key: creditTransactions.idempotencyKey,
      note: creditTransactions.note,
      type: creditTransactions.type,
      created_at: creditTransactions.createdAt,
    });

  return transaction ?? null;
}

export function mapCreditTransactionJoinRows(rows: CreditTransactionJoinRow[]) {
  return rows.map(row => {
    const student =
      row.student_id === null
        ? null
        : {
            id: row.student_id,
            user_id: row.student_user_id,
            grade: row.student_grade,
            users: {
              first_name: row.student_first_name,
              last_name: row.student_last_name,
              email: row.student_email,
              phone: row.student_phone,
            },
          };

    const session =
      row.session_id === null
        ? null
        : {
            id: row.session_id,
            subject_id: row.session_subject_id,
            tutor_id: row.session_tutor_id,
            scheduled_at: row.scheduled_at,
            ends_at: row.ends_at,
            status: row.status,
            student_id: row.student_id,
            student,
          };

    return {
      id: row.id,
      parent_id: row.parent_id,
      session_id: row.session_id,
      available_delta: row.available_delta,
      pending_delta: row.pending_delta,
      available_after: row.available_after,
      pending_after: row.pending_after,
      type: row.type,
      created_at: row.created_at,
      idempotency_key: row.idempotency_key,
      note: row.note,
      parent: {
        users: {
          first_name: row.parent_first_name,
          last_name: row.parent_last_name,
        },
      },
      session,
    };
  });
}

export function parseCreditTransactionRows(rows: CreditTransactionJoinRow[]) {
  return TransactionsWithJoinsListSchema.safeParse(mapCreditTransactionJoinRows(rows));
}
