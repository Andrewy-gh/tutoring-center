import { AVAILABLE_SLOTS_ERROR_MESSAGES, getAvailableSlots } from '@/lib/data/available-sessions';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: mockDbSelect,
  },
}));

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

function createSelectQuery(result: unknown) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve: (value: unknown) => void, reject?: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject)
    ),
  };

  return query;
}

describe('getAvailableSlots', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws tutor-subject error when relationship is missing', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([]))
      .mockReturnValueOnce(createSelectQuery([]))
      .mockReturnValueOnce(createSelectQuery([]));

    await expect(getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).rejects.toThrow(
      AVAILABLE_SLOTS_ERROR_MESSAGES.tutorSubject
    );
  });

  it('returns empty array when availability is empty', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 1 }]))
      .mockReturnValueOnce(createSelectQuery([]))
      .mockReturnValueOnce(createSelectQuery([]));

    await expect(getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).resolves.toEqual([]);
  });

  it('defensively ignores free-slot statuses and out-of-range sessions', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 1 }]))
      .mockReturnValueOnce(createSelectQuery(MONDAY_AVAILABILITY))
      .mockReturnValueOnce(
        createSelectQuery([
          { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z', status: 'Canceled' },
          { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z', status: 'Rescheduled' },
          { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z', status: 'Scheduled' },
        ])
      );

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([
      { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z' },
      { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
    ]);
  });

  it('uses half-open interval semantics: boundary-touching sessions do not block slots', async () => {
    mockDbSelect
      .mockReturnValueOnce(createSelectQuery([{ id: 1 }]))
      .mockReturnValueOnce(createSelectQuery(MONDAY_AVAILABILITY))
      .mockReturnValueOnce(
        createSelectQuery([
          { scheduled_at: '2026-03-02T19:00:00.000Z', ends_at: '2026-03-02T20:00:00.000Z', status: 'Scheduled' },
          { scheduled_at: '2026-03-02T23:00:00.000Z', ends_at: '2026-03-03T00:00:00.000Z', status: 'Scheduled' },
        ])
      );

    const result = await getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual(ALL_THREE_SLOTS);
  });
});
