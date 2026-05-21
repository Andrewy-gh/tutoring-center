import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getParentIdByUserId } from '@/db/queries/actors';
import { createCreditTransaction } from '@/db/queries/credits/transactions';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { TransactionCreateSchema } from '@/lib/validators/transactions';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error';
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
    available_delta_minutes,
    pending_delta_minutes,
    available_after_minutes,
    pending_after_minutes,
    idempotency_key,
    note,
    type,
  } = parsed.data;

  try {
    const transaction = await createCreditTransaction({
      parent_id,
      session_id: session_id ?? null,
      available_delta_minutes,
      pending_delta_minutes,
      available_after_minutes,
      pending_after_minutes,
      idempotency_key,
      note,
      type,
    });

    return NextResponse.json({ data: transaction });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
