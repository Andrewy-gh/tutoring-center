import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import { creditBalances, parents } from '@/lib/db/schema';
import { BalanceQuerySchema, BalanceUpdateSchema } from '@/lib/validators/balances';
import { eq, sql } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
}

async function resolveParentId(requestedParentId?: number) {
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
    if (!requestedParentId) {
      return { response: NextResponse.json({ error: 'parent_id is required' }, { status: 400 }) };
    }

    return { parentId: requestedParentId };
  }

  const userId = Number.parseInt(userIdRaw ?? '', 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  let parent;
  try {
    const parentId = await getParentIdByUserId(userId);
    parent = parentId ? { id: parentId } : null;
  } catch (error) {
    return { response: NextResponse.json({ error: getErrorMessage(error) }, { status: 500 }) };
  }

  if (!parent) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { parentId: parent.id };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parentIdRaw = url.searchParams.get('parent_id');
  const studentId = url.searchParams.get('student_id') ?? undefined;

  const requestedParentId = parentIdRaw ? Number.parseInt(parentIdRaw, 10) : undefined;
  const resolvedParent = await resolveParentId(requestedParentId);
  if (resolvedParent.response) {
    return resolvedParent.response;
  }

  const parsed = BalanceQuerySchema.safeParse({
    parent_id: resolvedParent.parentId,
    student_id: studentId,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { parent_id } = parsed.data;

  try {
    const db = await getDb();
    const rows = await db
      .select({
        parent_id: creditBalances.parentId,
        amount_available: creditBalances.amountAvailable,
        amount_pending: creditBalances.amountPending,
      })
      .from(creditBalances)
      .where(eq(creditBalances.parentId, parent_id))
      .limit(1);

    const [balance] = rows;
    if (!balance) {
      return NextResponse.json({ error: 'No credit balance found for the given parent_id' }, { status: 404 });
    }

    return NextResponse.json(balance);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const requestedParentId =
    body && typeof body === 'object' && 'parent_id' in body && typeof body.parent_id === 'number'
      ? body.parent_id
      : undefined;
  const resolvedParent = await resolveParentId(requestedParentId);
  if (resolvedParent.response) {
    return resolvedParent.response;
  }

  const parsed = BalanceUpdateSchema.safeParse({
    ...(body && typeof body === 'object' ? body : {}),
    parent_id: resolvedParent.parentId,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { parent_id, amount_available, amount_pending } = parsed.data;

  try {
    const db = await getDb();
    const [parent] = await db.select({ id: parents.id }).from(parents).where(eq(parents.id, parent_id)).limit(1);

    if (!parent) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const [balance] = await db
      .insert(creditBalances)
      .values({
        parentId: parent_id,
        amountAvailable: amount_available,
        amountPending: amount_pending,
      })
      .onConflictDoUpdate({
        target: creditBalances.parentId,
        set: {
          amountAvailable: amount_available,
          amountPending: amount_pending,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        parent_id: creditBalances.parentId,
        amount_available: creditBalances.amountAvailable,
        amount_pending: creditBalances.amountPending,
      });

    return NextResponse.json(balance);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
