import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { creditTransactions, parents, sessions, students, users } from '@/lib/db/schema';
import {
  TransactionCreateSchema,
  TransactionListQuerySchema,
  TransactionsWithJoins,
  TransactionsWithJoinsListSchema,
} from '@/lib/validators/transactions';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

async function resolveParentId(requestedParentId?: number, options?: { requireParentIdForAdmin?: boolean }) {
  const cookieStore = await cookies();
  const role = cookieStore.get(USER_ROLE_COOKIE_NAME)?.value;
  const userIdRaw = cookieStore.get(USER_ID_COOKIE_NAME)?.value;

  if (!isValidRole(role)) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (role === 'tutor') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (role === 'admin') {
    if (options?.requireParentIdForAdmin && !requestedParentId) {
      return { response: NextResponse.json({ error: 'parent_id is required' }, { status: 400 }) };
    }

    return { parentId: requestedParentId };
  }

  const userId = Number.parseInt(userIdRaw ?? '', 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  if (!parent) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { parentId: parent.id };
}

type TransactionListFilters = {
  parent_id?: number;
  student_id?: number;
  session_id?: number;
  type: (typeof TransactionListQuerySchema)['shape']['type']['_type'];
  start_date?: string;
  end_date?: string;
};

function buildWhereClauses({ parent_id, student_id, session_id, type, start_date, end_date }: TransactionListFilters) {
  const filters = [];

  if (parent_id) filters.push(eq(creditTransactions.parentId, parent_id));
  if (student_id) filters.push(eq(sessions.studentId, student_id));
  if (session_id) filters.push(eq(creditTransactions.sessionId, session_id));
  if (type && type !== 'all') filters.push(eq(creditTransactions.type, type));
  if (start_date) filters.push(gte(creditTransactions.createdAt, start_date));
  if (end_date) filters.push(lte(creditTransactions.createdAt, end_date));

  return filters;
}

function mapTransactionJoinRows(
  rows: Array<{
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
  }>
): TransactionsWithJoins[] {
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

async function getTransactionCount(filters: TransactionListFilters) {
  const db = await getDb();
  const rows = await db
    .select({
      count: sql<number>`cast(count(distinct ${creditTransactions.id}) as int)`,
    })
    .from(creditTransactions)
    .leftJoin(sessions, eq(creditTransactions.sessionId, sessions.id))
    .where(and(...buildWhereClauses(filters)));

  return rows[0]?.count ?? 0;
}

async function getTransactionRows(filters: TransactionListFilters, from: number, pageSize: number) {
  const db = await getDb();
  const parentUsers = alias(users, 'api_credit_parent_users');
  const studentUsers = alias(users, 'api_credit_student_users');

  const rows = await db
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
    .where(and(...buildWhereClauses(filters)))
    .limit(pageSize)
    .offset(from);

  return rows;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parentIdRaw = url.searchParams.get('parent_id');
  const requestedParentId = parentIdRaw ? Number.parseInt(parentIdRaw, 10) : undefined;
  const resolvedParent = await resolveParentId(requestedParentId);
  if (resolvedParent.response) {
    return resolvedParent.response;
  }

  const parsed = TransactionListQuerySchema.safeParse({
    parent_id: resolvedParent.parentId,
    student_id: url.searchParams.get('student_id') ?? undefined,
    session_id: url.searchParams.get('session_id') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    start_date: url.searchParams.get('start_date') ?? undefined,
    end_date: url.searchParams.get('end_date') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { parent_id, student_id, session_id, type, start_date, end_date, page, page_size } = parsed.data;
  const from = (page - 1) * page_size;
  const filters = { parent_id, student_id, session_id, type, start_date, end_date };

  const total = await getTransactionCount(filters);
  const totalPages = total === 0 ? 0 : Math.ceil(total / page_size);

  if (total === 0 || from >= total) {
    return NextResponse.json({
      data: [],
      page,
      page_size,
      total,
      totalPages,
      hasNextPage: false,
      hasPrevPage: page > 1,
      filters,
    });
  }

  const joinRows = await getTransactionRows(filters, from, page_size);
  const mappedRows = mapTransactionJoinRows(joinRows);
  const joinParsed = TransactionsWithJoinsListSchema.safeParse(mappedRows);

  if (!joinParsed.success) {
    return NextResponse.json({ error: 'Unexpected sessions join shape returned from Supabase' }, { status: 500 });
  }

  const normalizedData = joinParsed.data.map((row: TransactionsWithJoins) => {
    const session = row.session && !Array.isArray(row.session) ? row.session : null;
    const parent = row.parent && !Array.isArray(row.parent) ? row.parent : null;
    const student = session?.student && !Array.isArray(session.student) ? session.student : null;

    return { ...row, parent, student, session };
  });

  return NextResponse.json({
    data: normalizedData,
    page,
    page_size,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    filters,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const requestedParentId =
    body && typeof body === 'object' && 'parent_id' in body && typeof body.parent_id === 'number'
      ? body.parent_id
      : undefined;
  const resolvedParent = await resolveParentId(requestedParentId, { requireParentIdForAdmin: true });
  if (resolvedParent.response) {
    return resolvedParent.response;
  }

  const parsed = TransactionCreateSchema.safeParse({
    ...(body && typeof body === 'object' ? body : {}),
    parent_id: resolvedParent.parentId,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.flatten() }, { status: 400 });
  }

  const {
    parent_id,
    session_id,
    available_delta,
    pending_delta,
    available_after,
    pending_after,
    idempotency_key,
    note,
    type,
  } = parsed.data;

  const db = await getDb();
  const [transaction] = await db
    .insert(creditTransactions)
    .values({
      parentId: parent_id,
      sessionId: session_id,
      availableDelta: available_delta,
      pendingDelta: pending_delta,
      availableAfter: available_after,
      pendingAfter: pending_after,
      idempotencyKey: idempotency_key,
      note,
      type,
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

  return NextResponse.json({ data: transaction });
}
