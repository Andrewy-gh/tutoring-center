import { PATCH, POST } from '@/app/api/sessions/route';
import { USER_ID_COOKIE_NAME, USER_ROLE_COOKIE_NAME } from '@/lib/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCookies,
  mockDbUpdate,
  mockGetParentIdByUserId,
  mockBookSession,
  mockRevalidatePath,
  MockCreditBalanceNotFoundError,
  MockInsufficientCreditsError,
  MockParentStudentMismatchError,
  MockSessionOverlapError,
} = vi.hoisted(() => {
  class MockSessionOverlapError extends Error {
    constructor() {
      super('Tutor already has a session in that time range');
      this.name = 'SessionOverlapError';
    }
  }

  class MockInsufficientCreditsError extends Error {
    constructor() {
      super('Insufficient credits');
      this.name = 'InsufficientCreditsError';
    }
  }

  class MockCreditBalanceNotFoundError extends Error {
    constructor() {
      super('No credit balance found for parent');
      this.name = 'CreditBalanceNotFoundError';
    }
  }

  class MockParentStudentMismatchError extends Error {
    constructor() {
      super('Student does not belong to parent');
      this.name = 'ParentStudentMismatchError';
    }
  }

  return {
    mockCookies: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockGetParentIdByUserId: vi.fn(),
    mockBookSession: vi.fn(),
    mockRevalidatePath: vi.fn(),
    MockCreditBalanceNotFoundError,
    MockInsufficientCreditsError,
    MockParentStudentMismatchError,
    MockSessionOverlapError,
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    update: mockDbUpdate,
  },
}));

vi.mock('@/lib/db/queries/actors', () => ({
  getParentIdByUserId: mockGetParentIdByUserId,
}));

vi.mock('@/lib/db/book-session', () => ({
  bookSession: mockBookSession,
  SessionOverlapError: MockSessionOverlapError,
  InsufficientCreditsError: MockInsufficientCreditsError,
  CreditBalanceNotFoundError: MockCreditBalanceNotFoundError,
  ParentStudentMismatchError: MockParentStudentMismatchError,
}));

const BASE_BODY = {
  tutor_id: 11,
  student_id: 22,
  subject_id: 33,
  slot_units: 2,
  scheduled_at: '2026-03-02T15:00:00.000Z',
  ends_at: '2026-03-02T16:00:00.000Z',
};

function makeJsonRequest(url: string, method: 'PATCH' | 'POST', body: Record<string, unknown>) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setCookies(role?: string, userId?: string) {
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === USER_ROLE_COOKIE_NAME && role) return { value: role };
      if (name === USER_ID_COOKIE_NAME && userId) return { value: userId };
      return undefined;
    }),
  });
}

function createUpdateQuery(result: unknown) {
  const query = {
    set: vi.fn(() => query),
    where: vi.fn(() => query),
    returning: vi.fn().mockResolvedValue(result),
  };

  return query;
}

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('parent', '42');
    mockGetParentIdByUserId.mockResolvedValue(77);
    mockBookSession.mockResolvedValue({
      session: { id: 1001 },
    });
  });

  it('returns 401 when role cookie is missing', async () => {
    setCookies(undefined, '42');

    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 999 })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 for tutor role', async () => {
    setCookies('tutor', '42');

    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 999 })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('derives parent_id from auth for parent role and ignores request parent_id', async () => {
    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 999 })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockGetParentIdByUserId).toHaveBeenCalledWith(42);
    expect(mockBookSession).toHaveBeenCalledWith({
      tutorId: 11,
      studentId: 22,
      subjectId: 33,
      parentId: 77,
      slotUnits: 2,
      scheduledAt: '2026-03-02T15:00:00.000Z',
      endsAt: '2026-03-02T16:00:00.000Z',
      status: undefined,
    });
    expect(body.data).toEqual({ id: 1001 });
  });

  it('returns 400 when slot units do not match the scheduled time range', async () => {
    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, slot_units: 1, parent_id: 999 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid body');
    expect(mockBookSession).not.toHaveBeenCalled();
  });

  it('returns 400 for admin requests without parent_id', async () => {
    setCookies('admin', '1');

    const response = await POST(makeJsonRequest('https://example.test/api/sessions', 'POST', BASE_BODY));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('parent_id is required');
  });

  it('returns 409 when booking hits an overlap conflict', async () => {
    setCookies('admin', '1');
    mockBookSession.mockRejectedValueOnce(new MockSessionOverlapError());

    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Tutor already has a session in that time range');
  });

  it('returns 409 when booking hits insufficient credits', async () => {
    setCookies('admin', '1');
    mockBookSession.mockRejectedValueOnce(new MockInsufficientCreditsError());

    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Insufficient credits');
  });

  it('returns 409 when the parent has no credit balance', async () => {
    setCookies('admin', '1');
    mockBookSession.mockRejectedValueOnce(new MockCreditBalanceNotFoundError());

    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('No credit balance found for parent');
  });

  it('returns 403 when the student does not belong to the parent', async () => {
    setCookies('admin', '1');
    mockBookSession.mockRejectedValueOnce(new MockParentStudentMismatchError());

    const response = await POST(
      makeJsonRequest('https://example.test/api/sessions', 'POST', { ...BASE_BODY, parent_id: 5 })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Student does not belong to parent');
  });
});

describe('PATCH /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('admin', '1');
  });

  it('returns 401 when role cookie is missing', async () => {
    setCookies(undefined, '1');

    const response = await PATCH(
      makeJsonRequest('https://example.test/api/sessions', 'PATCH', { id: 55, status: 'Completed' })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 when the caller is not an admin', async () => {
    setCookies('parent', '1');

    const response = await PATCH(
      makeJsonRequest('https://example.test/api/sessions', 'PATCH', { id: 55, status: 'Completed' })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 404 when the session update affects no rows', async () => {
    mockDbUpdate.mockReturnValueOnce(createUpdateQuery([]));

    const response = await PATCH(
      makeJsonRequest('https://example.test/api/sessions', 'PATCH', { id: 55, status: 'Completed' })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Session not found');
  });

  it('updates the session status and revalidates the dashboard', async () => {
    mockDbUpdate.mockReturnValueOnce(
      createUpdateQuery([
        {
          id: 55,
          tutor_id: 11,
          student_id: 22,
          subject_id: 33,
          parent_id: 44,
          slot_units: 1,
          scheduled_at: '2026-03-02T15:00:00.000Z',
          ends_at: '2026-03-02T16:00:00.000Z',
          status: 'Completed',
        },
      ])
    );

    const response = await PATCH(
      makeJsonRequest('https://example.test/api/sessions', 'PATCH', { id: 55, status: 'Completed' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: {
        id: 55,
        tutor_id: 11,
        student_id: 22,
        subject_id: 33,
        parent_id: 44,
        slot_units: 1,
        scheduled_at: '2026-03-02T15:00:00.000Z',
        ends_at: '2026-03-02T16:00:00.000Z',
        status: 'Completed',
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard');
  });
});
