import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGetSubjectMapByIds, mockGetTutorProfileMapByIds } = vi.hoisted(() => ({
  mockGetSubjectMapByIds: vi.fn(),
  mockGetTutorProfileMapByIds: vi.fn(),
}));

const sessionsQuery = {
  data: [
    {
      id: 1,
      tutor_id: 10,
      student_id: 100,
      subject_id: 1000,
      parent_id: 10000,
      slot_units: 2,
      scheduled_at: '2026-03-01T10:00:00.000Z',
      ends_at: '2026-03-01T11:00:00.000Z',
      status: 'Completed',
      student: null,
      parent: null,
      session_progress: null,
      session_metrics: null,
    },
    {
      id: 2,
      tutor_id: 20,
      student_id: 200,
      subject_id: 2000,
      parent_id: 20000,
      slot_units: 2,
      scheduled_at: '2026-03-02T10:00:00.000Z',
      ends_at: '2026-03-02T11:00:00.000Z',
      status: 'Scheduled',
      student: null,
      parent: null,
      session_progress: null,
      session_metrics: null,
    },
    {
      id: 3,
      tutor_id: 30,
      student_id: 300,
      subject_id: 3000,
      parent_id: 30000,
      slot_units: 2,
      scheduled_at: '2026-03-04T10:00:00.000Z',
      ends_at: '2026-03-04T11:00:00.000Z',
      status: 'Pending-Notes',
      student: null,
      parent: null,
      session_progress: null,
      session_metrics: null,
    },
    {
      id: 4,
      tutor_id: 40,
      student_id: 400,
      subject_id: 4000,
      parent_id: 40000,
      slot_units: 2,
      scheduled_at: '2026-03-03T10:00:00.000Z',
      ends_at: '2026-03-03T11:00:00.000Z',
      status: 'Scheduled',
      student: null,
      parent: null,
      session_progress: null,
      session_metrics: null,
    },
    {
      id: 5,
      tutor_id: 50,
      student_id: 500,
      subject_id: 5000,
      parent_id: 50000,
      slot_units: 2,
      scheduled_at: '2026-03-05T10:00:00.000Z',
      ends_at: '2026-03-05T11:00:00.000Z',
      status: 'Rescheduled',
      student: null,
      parent: null,
      session_progress: null,
      session_metrics: null,
    },
  ],
  error: null,
  gte: vi.fn(),
  neq: vi.fn(),
  lt: vi.fn(),
  eq: vi.fn(),
};

sessionsQuery.gte.mockImplementation(() => sessionsQuery);
sessionsQuery.neq.mockImplementation(() => sessionsQuery);
sessionsQuery.lt.mockImplementation(() => sessionsQuery);
sessionsQuery.eq.mockImplementation(() => sessionsQuery);

vi.mock('@/lib/auth', () => ({
  getCurrentUserID: vi.fn(),
  getUserRole: vi.fn(async () => 'admin'),
}));

vi.mock('@/lib/data/subjects', () => ({
  getSubjectMapByIds: mockGetSubjectMapByIds,
}));

vi.mock('@/lib/data/tutors', () => ({
  getTutorProfileMapByIds: mockGetTutorProfileMapByIds,
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => sessionsQuery),
    })),
  })),
}));

describe('getSessions ordering', () => {
  afterEach(() => {
    sessionsQuery.gte.mockClear();
    sessionsQuery.neq.mockClear();
    sessionsQuery.lt.mockClear();
    sessionsQuery.eq.mockClear();
    vi.resetModules();
  });

  it('puts Scheduled sessions first and sorts both groups by latest date first', async () => {
    mockGetSubjectMapByIds.mockResolvedValue(
      new Map([
        [1000, { id: 1000, name: 'Subject 1', slug: 'subject-1' }],
        [2000, { id: 2000, name: 'Subject 2', slug: 'subject-2' }],
        [3000, { id: 3000, name: 'Subject 3', slug: 'subject-3' }],
        [4000, { id: 4000, name: 'Subject 4', slug: 'subject-4' }],
        [5000, { id: 5000, name: 'Subject 5', slug: 'subject-5' }],
      ])
    );
    mockGetTutorProfileMapByIds.mockResolvedValue(
      new Map([
        [10, { id: 10, name: 'Tutor 1', email: '', phone: '—' }],
        [20, { id: 20, name: 'Tutor 2', email: '', phone: '—' }],
        [30, { id: 30, name: 'Tutor 3', email: '', phone: '—' }],
        [40, { id: 40, name: 'Tutor 4', email: '', phone: '—' }],
        [50, { id: 50, name: 'Tutor 5', email: '', phone: '—' }],
      ])
    );

    const { getSessions } = await import('@/lib/data/sessions');

    const sessions = await getSessions();

    expect(sessions.map(session => session.id)).toEqual([4, 2, 5, 3, 1]);
  });
});
