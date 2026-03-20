import { AVAILABLE_SLOTS_ERROR_MESSAGES, getAvailableSlots } from '@/lib/data/available-sessions';
import { FREE_SLOT_STATUSES } from '@/lib/supabase/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateSupabaseServiceClient } = vi.hoisted(() => ({
  mockCreateSupabaseServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/serverClient', () => ({
  createSupabaseServiceClient: mockCreateSupabaseServiceClient,
}));

type QueryResult<T> = { data: T; error: { message: string } | null };
type AvailabilityLike = { week_day: string; start_time: string; end_time: string };
type SessionLike = { scheduled_at: string; ends_at: string; status?: string | null };

const RANGE_FROM = '2026-03-02';
const RANGE_TO = '2026-03-03';
const MONDAY_AVAILABILITY: AvailabilityLike[] = [{ week_day: 'Monday', start_time: '15:00:00', end_time: '18:00:00' }];
const ALL_THREE_SLOTS = [
  { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z' },
  { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z' },
  { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
];

function createQuery<T>(result: QueryResult<T>) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: vi.fn((resolve: (value: QueryResult<T>) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

function createClient({
  tutorSubjectResult,
  availabilityResult,
  sessionsResult,
}: {
  tutorSubjectResult: QueryResult<{ id: number } | null>;
  availabilityResult: QueryResult<AvailabilityLike[] | null>;
  sessionsResult: QueryResult<SessionLike[] | null>;
}) {
  const tutorSubjectsQuery = createQuery(tutorSubjectResult);
  const availabilityQuery = createQuery(availabilityResult);
  const sessionsQuery = createQuery(sessionsResult);

  const from = vi.fn((table: string) => {
    if (table === 'tutor_subjects') return tutorSubjectsQuery;
    if (table === 'availability') return availabilityQuery;
    if (table === 'sessions') return sessionsQuery;
    throw new Error(`Unexpected table ${table}`);
  });

  return { client: { from }, from, tutorSubjectsQuery, availabilityQuery, sessionsQuery };
}

describe('getAvailableSlots', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws database error when tutor-subject lookup errors', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: null, error: { message: 'db down' } },
      availabilityResult: { data: [], error: null },
      sessionsResult: { data: [], error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    await expect(getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).rejects.toThrow(
      AVAILABLE_SLOTS_ERROR_MESSAGES.database
    );
  });

  it('throws tutor-subject error when relationship is missing', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: null, error: null },
      availabilityResult: { data: [], error: null },
      sessionsResult: { data: [], error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    await expect(getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).rejects.toThrow(
      AVAILABLE_SLOTS_ERROR_MESSAGES.tutorSubject
    );
  });

  it('returns empty array when availability is empty', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: { data: [], error: null },
      sessionsResult: { data: null, error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([]);
  });

  it('builds tutor-subject, availability, and session queries with ET boundaries', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: { data: MONDAY_AVAILABILITY, error: null },
      sessionsResult: { data: [], error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);

    expect(singleClient.tutorSubjectsQuery.eq).toHaveBeenCalledWith('tutor_id', 3);
    expect(singleClient.tutorSubjectsQuery.eq).toHaveBeenCalledWith('subject_id', 7);
    expect(singleClient.availabilityQuery.eq).toHaveBeenCalledWith('tutor_id', 3);
    expect(singleClient.sessionsQuery.eq).toHaveBeenCalledWith('tutor_id', 3);
    expect(singleClient.sessionsQuery.filter).toHaveBeenCalledWith(
      'status',
      'not.in',
      `(${FREE_SLOT_STATUSES.join(',')})`
    );
    expect(singleClient.sessionsQuery.filter).toHaveBeenCalledWith('scheduled_at', 'lt', '2026-03-03T05:00:00.000Z');
    expect(singleClient.sessionsQuery.filter).toHaveBeenCalledWith('ends_at', 'gt', '2026-03-02T05:00:00.000Z');
  });

  it('defensively ignores free-slot statuses and out-of-range sessions', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: { data: MONDAY_AVAILABILITY, error: null },
      sessionsResult: {
        data: [
          { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z', status: 'Canceled' },
          { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z', status: 'Rescheduled' },
          { scheduled_at: '2026-03-01T23:00:00.000Z', ends_at: '2026-03-02T04:59:59.000Z', status: 'Scheduled' },
          { scheduled_at: '2026-03-03T05:00:00.000Z', ends_at: '2026-03-03T06:00:00.000Z', status: 'Scheduled' },
          { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z', status: 'Scheduled' },
        ],
        error: null,
      },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([
      { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z' },
      { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
    ]);
  });

  it('uses half-open interval semantics: boundary-touching sessions do not block slots', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: { data: MONDAY_AVAILABILITY, error: null },
      sessionsResult: {
        data: [
          { scheduled_at: '2026-03-02T19:00:00.000Z', ends_at: '2026-03-02T20:00:00.000Z', status: 'Scheduled' },
          { scheduled_at: '2026-03-02T23:00:00.000Z', ends_at: '2026-03-03T00:00:00.000Z', status: 'Scheduled' },
        ],
        error: null,
      },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual(ALL_THREE_SLOTS);
  });

  it('blocks partially overlapping sessions', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: { data: MONDAY_AVAILABILITY, error: null },
      sessionsResult: {
        data: [{ scheduled_at: '2026-03-02T20:30:00.000Z', ends_at: '2026-03-02T21:30:00.000Z', status: 'Scheduled' }],
        error: null,
      },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([{ scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' }]);
  });

  it('supports sessions=null and still emits slots', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: { data: MONDAY_AVAILABILITY, error: null },
      sessionsResult: { data: null, error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual(ALL_THREE_SLOTS);
  });

  it('snaps odd availability starts to the next slot boundary', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: {
        data: [{ week_day: 'Monday', start_time: '15:10:00', end_time: '18:00:00' }],
        error: null,
      },
      sessionsResult: { data: [], error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([
      { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z' },
      { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
    ]);
  });

  it('returns no slots when availability window is shorter than slot duration', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: {
        data: [{ week_day: 'Monday', start_time: '15:00:00', end_time: '15:30:00' }],
        error: null,
      },
      sessionsResult: { data: [], error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([]);
  });

  it('deduplicates slots from overlapping availability windows', async () => {
    const singleClient = createClient({
      tutorSubjectResult: { data: { id: 1 }, error: null },
      availabilityResult: {
        data: [
          { week_day: 'Monday', start_time: '15:00:00', end_time: '17:00:00' },
          { week_day: 'Monday', start_time: '16:00:00', end_time: '18:00:00' },
        ],
        error: null,
      },
      sessionsResult: { data: [], error: null },
    });
    mockCreateSupabaseServiceClient.mockReturnValue(singleClient.client);

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual(ALL_THREE_SLOTS);
  });
});
