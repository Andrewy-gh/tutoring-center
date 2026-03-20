import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { parents, sessions, students, users } from '@/lib/db/schema';
import {
  SessionCreateSchema,
  SessionListQuerySchema,
  SessionUpdateSchema,
  SessionWithJoinsListSchema,
  type SessionWithJoins,
} from '@/lib/validators/sessions';
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

type SessionApiRow = Omit<SessionWithJoins, 'student' | 'parent'> & {
  student: Record<string, unknown> | null;
  parent: Record<string, unknown> | null;
};

function buildSessionWhereClauses({
  parent_id,
  tutor_id,
  student_id,
  subject_id,
  status,
  kind,
  nowIso,
}: {
  parent_id?: number;
  tutor_id?: number;
  student_id?: number;
  subject_id?: number;
  status?: string;
  kind: 'all' | 'upcoming' | 'past';
  nowIso: string;
}) {
  const filters = [];

  if (parent_id) filters.push(eq(sessions.parentId, parent_id));
  if (tutor_id) filters.push(eq(sessions.tutorId, tutor_id));
  if (student_id) filters.push(eq(sessions.studentId, student_id));
  if (subject_id) filters.push(eq(sessions.subjectId, subject_id));
  if (status) filters.push(eq(sessions.status, status as typeof sessions.$inferSelect.status));
  if (kind === 'upcoming') filters.push(gte(sessions.scheduledAt, nowIso));
  if (kind === 'past') filters.push(lt(sessions.scheduledAt, nowIso));

  return filters;
}

function mapSessionJoinRows(
  rows: Array<{
    id: number;
    tutor_id: number;
    student_id: number;
    subject_id: number;
    parent_id: number;
    slot_units: number;
    scheduled_at: string;
    ends_at: string;
    status: typeof sessions.$inferSelect.status;
    student_parent_id: number | null;
    student_learning_goals: string | null;
    student_first_name: string | null;
    student_last_name: string | null;
    student_email: string;
    parent_billing_address: string | null;
    parent_notification_preferences: string | null;
    parent_first_name: string | null;
    parent_last_name: string | null;
    parent_email: string;
  }>
): SessionWithJoins[] {
  return rows.map(row => ({
    id: row.id,
    tutor_id: row.tutor_id,
    student_id: row.student_id,
    subject_id: row.subject_id,
    parent_id: row.parent_id,
    slot_units: row.slot_units,
    scheduled_at: row.scheduled_at,
    ends_at: row.ends_at,
    status: row.status,
    student: {
      id: row.student_id,
      parent_id: row.student_parent_id,
      learning_goals: row.student_learning_goals,
      users: {
        first_name: row.student_first_name,
        last_name: row.student_last_name,
        email: row.student_email,
      },
    },
    parent: {
      id: row.parent_id,
      billing_address: row.parent_billing_address,
      notification_preferences: row.parent_notification_preferences,
      users: {
        first_name: row.parent_first_name,
        last_name: row.parent_last_name,
        email: row.parent_email,
      },
    },
  }));
}

async function getSessionCount(filters: ReturnType<typeof buildSessionWhereClauses>) {
  const db = await getDb();
  const rows = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(sessions)
    .where(and(...filters));

  return rows[0]?.count ?? 0;
}

async function getSessionRows(
  filters: ReturnType<typeof buildSessionWhereClauses>,
  page: number,
  pageSize: number,
  kind: 'all' | 'upcoming' | 'past'
) {
  const db = await getDb();
  const studentUsers = alias(users, 'api_session_student_users');
  const parentUsers = alias(users, 'api_session_parent_users');

  const query = db
    .select({
      id: sessions.id,
      tutor_id: sessions.tutorId,
      student_id: sessions.studentId,
      subject_id: sessions.subjectId,
      parent_id: sessions.parentId,
      slot_units: sessions.slotUnits,
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
      student_parent_id: students.parentId,
      student_learning_goals: students.learningGoals,
      student_first_name: studentUsers.firstName,
      student_last_name: studentUsers.lastName,
      student_email: studentUsers.email,
      parent_billing_address: parents.billingAddress,
      parent_notification_preferences: parents.notificationPreferences,
      parent_first_name: parentUsers.firstName,
      parent_last_name: parentUsers.lastName,
      parent_email: parentUsers.email,
    })
    .from(sessions)
    .innerJoin(students, eq(sessions.studentId, students.id))
    .innerJoin(studentUsers, eq(students.userId, studentUsers.id))
    .innerJoin(parents, eq(sessions.parentId, parents.id))
    .innerJoin(parentUsers, eq(parents.userId, parentUsers.id))
    .where(and(...filters))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return kind === 'upcoming' ? query.orderBy(asc(sessions.scheduledAt)) : query.orderBy(desc(sessions.scheduledAt));
}

async function getParentIdByUserId(userId: number) {
  const db = await getDb();
  const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.userId, userId)).limit(1);

  return parent?.id ?? null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const parsed = SessionListQuerySchema.safeParse({
    kind: url.searchParams.get('kind') ?? undefined,
    parent_id: url.searchParams.get('parent_id') ?? undefined,
    tutor_id: url.searchParams.get('tutor_id') ?? undefined,
    student_id: url.searchParams.get('student_id') ?? undefined,
    subject_id: url.searchParams.get('subject_id') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    page_size: url.searchParams.get('page_size') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { kind, parent_id, tutor_id, student_id, subject_id, status, page, page_size } = parsed.data;
  const filters = buildSessionWhereClauses({
    kind,
    parent_id,
    tutor_id,
    student_id,
    subject_id,
    status,
    nowIso: new Date().toISOString(),
  });

  try {
    const total = await getSessionCount(filters);
    const totalPages = total === 0 ? 0 : Math.ceil(total / page_size);

    if (total === 0 || (page - 1) * page_size >= total) {
      return NextResponse.json({
        data: [],
        page,
        page_size,
        total,
        totalPages,
        hasNextPage: false,
        hasPrevPage: page > 1,
        filters: { kind, parent_id, tutor_id, student_id, subject_id, status },
      });
    }

    const rows = await getSessionRows(filters, page, page_size, kind);
    const joinedParsed = SessionWithJoinsListSchema.safeParse(mapSessionJoinRows(rows));

    if (!joinedParsed.success) {
      return NextResponse.json({ error: 'Unexpected sessions join shape returned from Supabase' }, { status: 500 });
    }

    const normalized: SessionApiRow[] = joinedParsed.data.map((row: SessionWithJoins) => {
      const student = row.student && !Array.isArray(row.student) ? row.student : null;
      const parent = row.parent && !Array.isArray(row.parent) ? row.parent : null;

      return {
        ...row,
        student,
        parent,
      };
    });

    return NextResponse.json({
      data: normalized,
      page,
      page_size,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1 && totalPages > 0,
      filters: { kind, parent_id, tutor_id, student_id, subject_id, status },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SessionCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
  }

  const s = parsed.data;
  const cookieStore = await cookies();
  const role = cookieStore.get(USER_ROLE_COOKIE_NAME)?.value;
  const userIdRaw = cookieStore.get(USER_ID_COOKIE_NAME)?.value;

  if (!isValidRole(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (role === 'tutor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bookingModule = await import('@/lib/db/book-session');

  try {
    let parentId = s.parent_id;
    if (role === 'parent') {
      const userId = Number.parseInt(userIdRaw ?? '', 10);
      if (!Number.isInteger(userId) || userId <= 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      parentId = (await getParentIdByUserId(userId)) ?? undefined;
      if (!parentId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!parentId) {
      return NextResponse.json({ error: 'parent_id is required' }, { status: 400 });
    }

    const { session } = await bookingModule.bookSession({
      tutorId: s.tutor_id,
      studentId: s.student_id,
      subjectId: s.subject_id,
      parentId,
      slotUnits: s.slot_units,
      scheduledAt: s.scheduled_at,
      endsAt: s.ends_at,
      status: s.status,
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    if (error instanceof bookingModule.SessionOverlapError) {
      return NextResponse.json({ error: 'Tutor already has a session in that time range' }, { status: 409 });
    }

    if (error instanceof bookingModule.InsufficientCreditsError) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 409 });
    }

    if (error instanceof bookingModule.CreditBalanceNotFoundError) {
      return NextResponse.json({ error: 'No credit balance found for parent' }, { status: 409 });
    }

    if (error instanceof bookingModule.ParentStudentMismatchError) {
      return NextResponse.json({ error: 'Student does not belong to parent' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = SessionUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
  }

  const cookieStore = await cookies();
  const role = cookieStore.get(USER_ROLE_COOKIE_NAME)?.value;

  if (!isValidRole(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = await getDb();
    const [session] = await db
      .update(sessions)
      .set({ status: parsed.data.status })
      .where(eq(sessions.id, parsed.data.id))
      .returning({
        id: sessions.id,
        tutor_id: sessions.tutorId,
        student_id: sessions.studentId,
        subject_id: sessions.subjectId,
        parent_id: sessions.parentId,
        slot_units: sessions.slotUnits,
        scheduled_at: sessions.scheduledAt,
        ends_at: sessions.endsAt,
        status: sessions.status,
      });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    revalidatePath('/dashboard');

    return NextResponse.json({ data: session });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
