import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import {
  buildSessionListFilters,
  getSessionListCount,
  getSessionListRows,
  parseSessionListRows,
} from '@/lib/db/queries/sessions/list';
import { sessions } from '@/lib/db/schema';
import { SessionCreateSchema, SessionListQuerySchema, SessionUpdateSchema } from '@/lib/validators/sessions';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
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
  const filters = buildSessionListFilters({
    kind,
    parentId: parent_id,
    tutorId: tutor_id,
    studentId: student_id,
    subjectId: subject_id,
    status,
    nowIso: new Date().toISOString(),
  });

  try {
    const total = await getSessionListCount(filters);
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

    const rows = await getSessionListRows(filters, { page, pageSize: page_size, orderByKind: kind });
    const joinedParsed = parseSessionListRows(rows);

    if (!joinedParsed.success) {
      return NextResponse.json({ error: 'Unexpected sessions join shape returned from the database' }, { status: 500 });
    }

    return NextResponse.json({
      data: joinedParsed.data,
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
