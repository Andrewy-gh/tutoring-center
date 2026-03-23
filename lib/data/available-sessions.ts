import 'server-only';
import { SLOT_DURATION_MINS, TIMEZONE } from '@/lib/constants';
import { getIsoDateWeekday, isoDatesInRange, tzDateTimeToUtcIso, tzDateToUtcIso } from '@/lib/date-utils.server';
import { FREE_SLOT_STATUSES, type FreeSlotStatus, type WeekDay } from '@/lib/db/types';
import {
  availability,
  sessions,
  tutorSubjects,
} from '@/lib/db/schema';
import type { AvailableSession } from '@/lib/validators/sessions';
import { and, eq, gt, lt, notInArray } from 'drizzle-orm';

function generateSlots(dateStr: string, startTime: string, endTime: string, timezone = TIMEZONE) {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const rawStartTotalMinutes = startHour * 60 + startMinute;
  // Snap to the next slot boundary so slots always begin on a clean interval.
  const alignedStartMinutes = Math.ceil(rawStartTotalMinutes / SLOT_DURATION_MINS) * SLOT_DURATION_MINS;
  const endTotalMinutes = endHour * 60 + endMinute;
  const slots: AvailableSession[] = [];

  for (
    let currentMinutes = alignedStartMinutes;
    currentMinutes + SLOT_DURATION_MINS <= endTotalMinutes;
    currentMinutes += SLOT_DURATION_MINS
  ) {
    const slotStartHour = Math.floor(currentMinutes / 60);
    const slotStartMinute = currentMinutes % 60;
    const slotEndHour = Math.floor((currentMinutes + SLOT_DURATION_MINS) / 60);
    const slotEndMinute = (currentMinutes + SLOT_DURATION_MINS) % 60;
    slots.push({
      scheduled_at: tzDateTimeToUtcIso(dateStr, slotStartHour, slotStartMinute, timezone),
      ends_at: tzDateTimeToUtcIso(dateStr, slotEndHour, slotEndMinute, timezone),
    });
  }

  return slots;
}

type AvailabilityRow = { week_day: WeekDay; start_time: string; end_time: string };
type BookedRow = { scheduled_at: string; ends_at: string };
type BookedRowWithStatus = BookedRow & { status?: string | null };

export const AVAILABLE_SLOTS_ERROR_MESSAGES = {
  database: 'Available slots are temporarily unavailable. Please retry in a moment.',
  tutorSubject: 'Tutor does not teach this subject',
} as const;

type TutorSubjectRow = { id: number };

export type AvailableSessionsServiceDeps = {
  findTutorSubject: (tutorId: number, subjectId: number) => Promise<TutorSubjectRow | null>;
  listAvailability: (tutorId: number) => Promise<AvailabilityRow[]>;
  listBookedSessions: (tutorId: number, fromUtc: string, toUtc: string) => Promise<BookedRowWithStatus[]>;
};

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

async function findTutorSubject(tutorId: number, subjectId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ id: tutorSubjects.id })
    .from(tutorSubjects)
    .where(and(eq(tutorSubjects.tutorId, tutorId), eq(tutorSubjects.subjectId, subjectId)))
    .limit(1);

  return row ?? null;
}

async function listAvailability(tutorId: number) {
  const db = await getDb();

  return db
    .select({
      week_day: availability.weekDay,
      start_time: availability.startTime,
      end_time: availability.endTime,
    })
    .from(availability)
    .where(eq(availability.tutorId, tutorId));
}

async function listBookedSessions(tutorId: number, fromUtc: string, toUtc: string) {
  const db = await getDb();

  return db
    .select({
      scheduled_at: sessions.scheduledAt,
      ends_at: sessions.endsAt,
      status: sessions.status,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.tutorId, tutorId),
        notInArray(sessions.status, [...FREE_SLOT_STATUSES]),
        lt(sessions.scheduledAt, toUtc),
        gt(sessions.endsAt, fromUtc)
      )
    );
}

export function buildAvailableSlots(
  availability: AvailabilityRow[],
  booked: BookedRow[],
  from: string,
  to: string,
  timezone = TIMEZONE
) {
  const bookedTimeRanges = booked.map(row => ({
    startMs: new Date(row.scheduled_at).getTime(),
    endMs: new Date(row.ends_at).getTime(),
  }));

  const availabilityByWeekday = new Map<WeekDay, AvailabilityRow[]>();
  for (const row of availability) {
    const existing = availabilityByWeekday.get(row.week_day) ?? [];
    availabilityByWeekday.set(row.week_day, [...existing, row]);
  }

  const slots: AvailableSession[] = [];
  const seen = new Set<string>();

  for (const dateStr of isoDatesInRange(from, to)) {
    const availabilityWindows = availabilityByWeekday.get(getIsoDateWeekday(dateStr)) ?? [];

    for (const window of availabilityWindows) {
      for (const slot of generateSlots(dateStr, window.start_time, window.end_time, timezone)) {
        if (seen.has(slot.scheduled_at)) continue;
        const slotFrom = new Date(slot.scheduled_at).getTime();
        const slotTo = new Date(slot.ends_at).getTime();
        if (!Number.isFinite(slotFrom) || !Number.isFinite(slotTo)) continue;

        const isBooked = bookedTimeRanges.some(range => slotFrom < range.endMs && slotTo > range.startMs);
        if (!isBooked) {
          seen.add(slot.scheduled_at);
          slots.push(slot);
        }
      }
    }
  }

  return slots.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

function filterActiveBookedSessions(rows: BookedRowWithStatus[] | null, fromUtc: string, toUtc: string) {
  return (rows ?? [])
    .filter(
      row =>
        !FREE_SLOT_STATUSES.includes(row.status as FreeSlotStatus) && row.scheduled_at < toUtc && row.ends_at > fromUtc
    )
    .map(({ scheduled_at, ends_at }) => ({ scheduled_at, ends_at }));
}

export function createAvailableSessionsService(deps: AvailableSessionsServiceDeps) {
  return {
    async getAvailableSlots(tutorId: number, subjectId: number, from: string, to: string, timezone = TIMEZONE) {
      const fromUtc = tzDateToUtcIso(from, timezone);
      const toUtc = tzDateToUtcIso(to, timezone);

      let tutorSubject: TutorSubjectRow | null;
      try {
        tutorSubject = await deps.findTutorSubject(tutorId, subjectId);
      } catch {
        throw new Error(AVAILABLE_SLOTS_ERROR_MESSAGES.database);
      }

      if (!tutorSubject) {
        throw new Error(AVAILABLE_SLOTS_ERROR_MESSAGES.tutorSubject);
      }

      let availabilityRows: AvailabilityRow[];
      let sessionRows: BookedRowWithStatus[];
      try {
        [availabilityRows, sessionRows] = await Promise.all([
          deps.listAvailability(tutorId),
          deps.listBookedSessions(tutorId, fromUtc, toUtc),
        ]);
      } catch {
        throw new Error(AVAILABLE_SLOTS_ERROR_MESSAGES.database);
      }

      if (!availabilityRows.length) return [];

      const booked = filterActiveBookedSessions(sessionRows, fromUtc, toUtc);
      return buildAvailableSlots(availabilityRows, booked, from, to, timezone);
    },
  };
}

export const availableSessionsService = createAvailableSessionsService({
  findTutorSubject,
  listAvailability,
  listBookedSessions,
});

export async function getAvailableSlots(
  tutorId: number,
  subjectId: number,
  from: string,
  to: string,
  timezone = TIMEZONE
) {
  return availableSessionsService.getAvailableSlots(tutorId, subjectId, from, to, timezone);
}
