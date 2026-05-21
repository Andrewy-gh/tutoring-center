import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getParentIdByUserId } from '@/db/queries/actors';
import { sessions } from '@/db/schema';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { SessionCreateSchema, SessionUpdateSchema } from '@/lib/validators/sessions';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
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

  const bookingModule = await import('@/db/book-session');

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
