import { GET, POST } from '@/app/api/sessions/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCookies,
  mockDbSelect,
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
    mockDbSelect: vi.fn(),
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

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
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

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(() => query),
    offset: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createRejectingSelectQuery(message: string) {
  const query = createSelectQuery([]);
  query.then.mockImplementationOnce((_resolve, reject) => Promise.reject(new Error(message)).then(undefined, reject));
  return query;
}

describe('GET /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns a JSON 500 when the session count query fails', async () => {
    mockDbSelect.mockReturnValueOnce(createRejectingSelectQuery('count failed'));

    const response = await GET(new Request('https://example.test/api/sessions?page=1&page_size=20'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'count failed' });
  });
});

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setCookies('parent', '42');
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
    mockDbSelect.mockReturnValueOnce(createSelectQuery([{ id: 77 }]));

    const response = await POST(makeRequest({ ...BASE_BODY, parent_id: 999 }));
    const body = await response.json();

    expect(response.status).toBe(201);
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
