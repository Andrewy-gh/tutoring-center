import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isValidRole, USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { getParentIdByUserId } from '@/lib/db/queries/actors';
import {
  buildCreditTransactionFilters,
  createCreditTransaction,
  getCreditTransactionCount,
  getCreditTransactionRows,
  parseCreditTransactionRows,
} from '@/lib/db/queries/credits/transactions';
import { TransactionCreateSchema, TransactionListQuerySchema } from '@/lib/validators/transactions';

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
  const filterInput = {
    parentId: parent_id,
    studentId: student_id,
    sessionId: session_id,
    type,
    startDate: start_date,
    endDate: end_date,
  };
  const filters = buildCreditTransactionFilters(filterInput);

  try {
    const total = await getCreditTransactionCount(filters);
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
        filters: { parent_id, student_id, session_id, type, start_date, end_date },
      });
    }

    const joinRows = await getCreditTransactionRows(filters, { from, pageSize: page_size });
    const joinParsed = parseCreditTransactionRows(joinRows);

    if (!joinParsed.success) {
      return NextResponse.json({ error: 'Unexpected sessions join shape returned from the database' }, { status: 500 });
    }

    return NextResponse.json({
      data: joinParsed.data,
      page,
      page_size,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      filters: { parent_id, student_id, session_id, type, start_date, end_date },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
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

  try {
    const transaction = await createCreditTransaction({
      parent_id,
      session_id: session_id ?? null,
      available_delta,
      pending_delta,
      available_after,
      pending_after,
      idempotency_key,
      note,
      type,
    });

    return NextResponse.json({ data: transaction });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
