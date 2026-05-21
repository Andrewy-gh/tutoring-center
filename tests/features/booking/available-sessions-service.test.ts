import {
  AVAILABLE_SLOTS_ERROR_MESSAGES,
  createAvailableSessionsService,
  type AvailableSessionsServiceDeps,
} from '@/features/booking/available-sessions-service';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const RANGE_FROM = '2026-03-02';
const RANGE_TO = '2026-03-03';
type AvailabilityRows = Awaited<ReturnType<AvailableSessionsServiceDeps['listAvailability']>>;
const MONDAY_AVAILABILITY: AvailabilityRows = [{ week_day: 'Monday', start_time: '15:00:00', end_time: '18:00:00' }];
const ALL_THREE_SLOTS = [
  { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z' },
  { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z' },
  { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
];
let deps: AvailableSessionsServiceDeps;
let findTutorSubjectMock: Mock<AvailableSessionsServiceDeps['findTutorSubject']>;
let listAvailabilityMock: Mock<AvailableSessionsServiceDeps['listAvailability']>;
let listBookedSessionsMock: Mock<AvailableSessionsServiceDeps['listBookedSessions']>;

function createDeps() {
  findTutorSubjectMock = vi.fn<AvailableSessionsServiceDeps['findTutorSubject']>().mockResolvedValue({ id: 1 });
  listAvailabilityMock = vi
    .fn<AvailableSessionsServiceDeps['listAvailability']>()
    .mockResolvedValue(MONDAY_AVAILABILITY);
  listBookedSessionsMock = vi.fn<AvailableSessionsServiceDeps['listBookedSessions']>().mockResolvedValue([]);

  const nextDeps: AvailableSessionsServiceDeps = {
    findTutorSubject: (tutorId, subjectId) => findTutorSubjectMock(tutorId, subjectId),
    listAvailability: tutorId => listAvailabilityMock(tutorId),
    listBookedSessions: (tutorId, fromUtc, toUtc) => listBookedSessionsMock(tutorId, fromUtc, toUtc),
  };

  return nextDeps;
}

describe('getAvailableSlots', () => {
  beforeEach(() => {
    deps = createDeps();
  });

  it('throws tutor-subject error when relationship is missing', async () => {
    findTutorSubjectMock.mockResolvedValueOnce(null);
    const service = createAvailableSessionsService(deps);

    await expect(service.getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).rejects.toThrow(
      AVAILABLE_SLOTS_ERROR_MESSAGES.tutorSubject
    );
  });

  it('returns empty array when availability is empty', async () => {
    listAvailabilityMock.mockResolvedValueOnce([]);
    const service = createAvailableSessionsService(deps);

    await expect(service.getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).resolves.toEqual([]);
  });

  it('defensively ignores free-slot statuses and out-of-range sessions', async () => {
    listBookedSessionsMock.mockResolvedValueOnce([
      { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z', status: 'Canceled' },
      { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z', status: 'Rescheduled' },
      { scheduled_at: '2026-03-02T21:00:00.000Z', ends_at: '2026-03-02T22:00:00.000Z', status: 'Scheduled' },
    ]);
    const service = createAvailableSessionsService(deps);

    const result = await service.getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual([
      { scheduled_at: '2026-03-02T20:00:00.000Z', ends_at: '2026-03-02T21:00:00.000Z' },
      { scheduled_at: '2026-03-02T22:00:00.000Z', ends_at: '2026-03-02T23:00:00.000Z' },
    ]);
  });

  it('uses half-open interval semantics: boundary-touching sessions do not block slots', async () => {
    listBookedSessionsMock.mockResolvedValueOnce([
      { scheduled_at: '2026-03-02T19:00:00.000Z', ends_at: '2026-03-02T20:00:00.000Z', status: 'Scheduled' },
      { scheduled_at: '2026-03-02T23:00:00.000Z', ends_at: '2026-03-03T00:00:00.000Z', status: 'Scheduled' },
    ]);
    const service = createAvailableSessionsService(deps);

    const result = await service.getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO);
    expect(result).toEqual(ALL_THREE_SLOTS);
  });

  it('maps dependency failures to the user-facing database error', async () => {
    listBookedSessionsMock.mockRejectedValueOnce(new Error('db failed'));
    const service = createAvailableSessionsService(deps);

    await expect(service.getAvailableSlots(3, 7, RANGE_FROM, RANGE_TO)).rejects.toThrow(
      AVAILABLE_SLOTS_ERROR_MESSAGES.database
    );
  });
});
