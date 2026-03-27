import 'server-only';
import { creditTransactions, parents, sessions, students, users } from '@/lib/db/schema';
import {
  CreditTransactionListQueryRowListSchema,
  type CreditTransactionListQueryRow,
} from '@/lib/validators/transactions';
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

export function parseCreditTransactionRows(rows: CreditTransactionListQueryRow[]) {
  return CreditTransactionListQueryRowListSchema.safeParse(rows);
}
