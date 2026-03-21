import 'server-only';
import { forbidden } from 'next/navigation';
import { isValidRole } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import { availability, tutors, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import { EmbeddedOneUserSchema } from '@/lib/validators/shared';
import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export type TutorOption = {
  id: number;
  user_id: number;
  name: string;
  education: string | null;
  years_experience: number | null;
  typicalAvailability: string | null;
};

const TUTOR_OPTIONS_ERROR_MESSAGES = {
  database: 'Tutor options are temporarily unavailable. Please retry in a moment.',
  validation: 'Tutor options format is invalid. Please try again later.',
} as const;

const WeekDaySchema = z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
const AvailabilityRowSchema = z.object({
  week_day: WeekDaySchema,
  start_time: z.string(),
  end_time: z.string(),
});
const TutorOptionQueryRowSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  education: z.string().nullable(),
  years_experience: z.number().nullable(),
  users: EmbeddedOneUserSchema,
  availability: z.array(AvailabilityRowSchema).nullable().optional(),
});
const TutorOptionQueryRowListSchema = z.array(TutorOptionQueryRowSchema);

type TutorOptionQueryRow = z.infer<typeof TutorOptionQueryRowSchema>;
type WeekDay = z.infer<typeof WeekDaySchema>;

type TutorOptionJoinRow = {
  id: unknown;
  userId: unknown;
  education: unknown;
  yearsExperience: unknown;
  firstName: unknown;
  lastName: unknown;
  email: unknown;
  phone: unknown;
  weekDay: unknown;
  startTime: unknown;
  endTime: unknown;
};

const WEEKDAY_ORDER: Record<WeekDay, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const WEEKDAY_SHORT: Record<WeekDay, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const formatTime = (time: string) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return time;

  const hour24 = Number.parseInt(match[1], 10);
  const minute = match[2];
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return time;

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  if (minute === '00') {
    return `${hour12}${suffix}`;
  }

  return `${hour12}:${minute}${suffix}`;
};

const toAvailabilitySummary = (availability: TutorOptionQueryRow['availability']) => {
  const rows = (availability ?? []).slice().sort((left, right) => {
    const weekdayCompare = WEEKDAY_ORDER[left.week_day] - WEEKDAY_ORDER[right.week_day];
    if (weekdayCompare !== 0) return weekdayCompare;
    return left.start_time.localeCompare(right.start_time);
  });

  if (rows.length === 0) return null;

  const chunks = rows.map(
    row => `${WEEKDAY_SHORT[row.week_day]} ${formatTime(row.start_time)}-${formatTime(row.end_time)}`
  );
  if (chunks.length <= 2) return chunks.join(' • ');
  return `${chunks.slice(0, 2).join(' • ')} +${chunks.length - 2} more`;
};

const mapTutorOption = (tutor: TutorOptionQueryRow): TutorOption => {
  const user = pickFirstEmbedded(tutor.users);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();

  return {
    id: tutor.id,
    user_id: tutor.user_id,
    name: name || '—',
    education: tutor.education,
    years_experience: tutor.years_experience,
    typicalAvailability: toAvailabilitySummary(tutor.availability),
  };
};

const mapTutorOptionRows = (rows: TutorOptionJoinRow[]) => {
  const tutorsById = new Map<number, TutorOptionQueryRow>();

  for (const row of rows) {
    const tutorId = Number(row.id);
    const existingTutor = tutorsById.get(tutorId);

    if (existingTutor) {
      if (row.weekDay !== null && row.weekDay !== undefined) {
        existingTutor.availability ??= [];
        existingTutor.availability.push({
          week_day: row.weekDay as WeekDay,
          start_time: row.startTime as string,
          end_time: row.endTime as string,
        });
      }

      continue;
    }

    tutorsById.set(tutorId, {
      id: row.id as number,
      user_id: row.userId as number,
      education: row.education as string | null,
      years_experience: row.yearsExperience as number | null,
      users: {
        first_name: row.firstName as string | null,
        last_name: row.lastName as string | null,
        email: row.email as string,
        phone: row.phone as string | null,
      },
      availability:
        row.weekDay === null || row.weekDay === undefined
          ? []
          : [
              {
                week_day: row.weekDay as WeekDay,
                start_time: row.startTime as string,
                end_time: row.endTime as string,
              },
            ],
    });
  }

  return Array.from(tutorsById.values());
};

export async function getTutorOptionsByIds(role: UserRole, tutorIds: number[]) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch tutor options.');
  }

  if (role !== 'parent' && role !== 'admin') {
    forbidden();
  }

  const uniqueTutorIds = [...new Set(tutorIds.filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueTutorIds.length === 0) {
    return [] as TutorOption[];
  }

  let rows: TutorOptionJoinRow[];
  try {
    const db = await getDb();
    rows = await db
      .select({
        id: tutors.id,
        userId: tutors.userId,
        education: tutors.education,
        yearsExperience: tutors.yearsExperience,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        weekDay: availability.weekDay,
        startTime: availability.startTime,
        endTime: availability.endTime,
      })
      .from(tutors)
      .innerJoin(users, eq(tutors.userId, users.id))
      .leftJoin(availability, eq(availability.tutorId, tutors.id))
      .where(inArray(tutors.id, uniqueTutorIds))
      .orderBy(asc(tutors.id), asc(availability.weekDay), asc(availability.startTime), asc(availability.endTime));
  } catch {
    throw new Error(TUTOR_OPTIONS_ERROR_MESSAGES.database);
  }

  const parsedTutors = TutorOptionQueryRowListSchema.safeParse(mapTutorOptionRows(rows));
  if (!parsedTutors.success) {
    throw new Error(TUTOR_OPTIONS_ERROR_MESSAGES.validation);
  }

  const sortOrder = new Map(uniqueTutorIds.map((id, index) => [id, index]));

  return parsedTutors.data
    .map(mapTutorOption)
    .sort(
      (left, right) =>
        (sortOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (sortOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
}
