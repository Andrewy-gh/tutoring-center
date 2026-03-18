import { POST } from '@/app/api/sessions/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCookies,
  mockCreateSupabaseServiceClient,
  mockBookSession,
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
    mockCreateSupabaseServiceClient: vi.fn(),
    mockBookSession: vi.fn(),
    MockSessionOverlapError,
    MockInsufficientCreditsError,
    MockCreditBalanceNotFoundError,
    MockParentStudentMismatchError,
  };
});

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

vi.mock('@/lib/db/book-session', () => {
  return {
    bookSession: mockBookSession,
    SessionOverlapError: MockSessionOverlapError,
    InsufficientCreditsError: MockInsufficientCreditsError,
    CreditBalanceNotFoundError: MockCreditBalanceNotFoundError,
    ParentStudentMismatchError: MockParentStudentMismatchError,
  };
});

type SupabaseSetup = {
  parentRow?: { id: number } | null;
  parentErr?: { message: string } | null;
};

const BASE_BODY = {
  tutor_id: 11,
  student_id: 22,
  subject_id: 33,
  slot_units: 1,
  scheduled_at: '2026-03-02T15:00:00.000Z',
  ends_at: '2026-03-02T16:00:00.000Z',
};

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://example.test/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setCookies(role?: string, userId?: string) {
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'user-role' && role) return { value: role };
      if (name === 'user-id' && userId) return { value: userId };
      return undefined;
    }),
  });
}

function setupSupabase({ parentRow = { id: 7 }, parentErr = null }: SupabaseSetup = {}) {
  const parentSingle = vi.fn().mockResolvedValue({ data: parentRow, error: parentErr });
  const parentEq = vi.fn().mockReturnValue({ single: parentSingle });
  const parentSelect = vi.fn().mockReturnValue({ eq: parentEq });

  const from = vi.fn((table: string) => {
    if (table === 'parents') {
      return { select: parentSelect };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  mockCreateSupabaseServiceClient.mockReturnValue({ from });

  return {
    from,
    parentEq,
  };
}

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('parent', '42');
    setupSupabase();
    mockBookSession.mockResolvedValue({
      session: { id: 1001 },
    });
  });

  it('returns 401 when role cookie is missing', async () => {
    setCookies(undefined, '42');

    const response = await POST(makeRequest({ ...BASE_BODY, parent_id: 999 }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 for tutor role', async () => {
    setCookies('tutor', '42');

    const response = await POST(makeRequest({ ...BASE_BODY, parent_id: 999 }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('derives parent_id from auth for parent role and ignores request parent_id', async () => {
    const { parentEq } = setupSupabase({
      parentRow: { id: 77 },
    });

    const response = await POST(makeRequest({ ...BASE_BODY, parent_id: 999 }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(parentEq).toHaveBeenCalledWith('user_id', 42);
    expect(mockBookSession).toHaveBeenCalledWith(
      expect.objectContaining({
        tutorId: 11,
        studentId: 22,
        subjectId: 33,
        parentId: 77,
      })
    );
    expect(body.data).toEqual({ id: 1001 });
  });

  it('returns 400 for admin requests without parent_id', async () => {
    setCookies('admin', '1');

    const response = await POST(makeRequest(BASE_BODY));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('parent_id is required');
  });

  it('returns 409 when booking hits an overlap conflict', async () => {
    setCookies('admin', '1');
    mockBookSession.mockRejectedValue(new MockSessionOverlapError());

    const response = await POST(makeRequest({ ...BASE_BODY, parent_id: 5 }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Tutor already has a session in that time range');
  });

  it('returns 409 when booking hits insufficient credits', async () => {
    setCookies('admin', '1');
    mockBookSession.mockRejectedValue(new MockInsufficientCreditsError());

    const response = await POST(makeRequest({ ...BASE_BODY, parent_id: 5 }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Insufficient credits');
  });
});
