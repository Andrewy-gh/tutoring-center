import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { getParentIdByUserId, parentExists } from '@/lib/db/queries/actors';
import { getCreditBalanceByParentId, upsertCreditBalance } from '@/lib/db/queries/credits/balances';
import { BalanceQuerySchema, BalanceUpdateSchema } from '@/lib/validators/balances';

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
    const balance = await getCreditBalanceByParentId(parent_id);
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

  const { parent_id, available_minutes, pending_minutes } = parsed.data;

  try {
    if (!(await parentExists(parent_id))) {
      return NextResponse.json({ error: 'Parent not found' }, { status: 404 });
    }

    const balance = await upsertCreditBalance(parent_id, { available_minutes, pending_minutes });

    return NextResponse.json(balance);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
