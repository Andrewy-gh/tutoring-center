import 'server-only';
import { availability, tutors, tutorSubjects, users } from '@/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
}

export type TutorProfileRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
};

export type TutorJoinRow = {
  id: number;
  userId: number;
  verified: boolean;
  education: string | null;
  bio: string | null;
  tagline: string | null;
  yearsExperience: number | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
};

export type TutorOptionRow = {
  id: number;
  userId: number;
  education: string | null;
  yearsExperience: number | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  weekDay: typeof availability.$inferSelect.weekDay | null;
  startTime: string | null;
  endTime: string | null;
};

export type TutorAvailabilityRow = {
  week_day: typeof availability.$inferSelect.weekDay;
  start_time: string;
  end_time: string;
};

export type TutorSubjectRow = {
  id: number;
};

const tutorJoinSelect = {
  id: tutors.id,
  userId: tutors.userId,
  verified: tutors.verified,
  education: tutors.education,
  bio: tutors.bio,
  tagline: tutors.tagline,
  yearsExperience: tutors.yearsExperience,
  firstName: users.firstName,
  lastName: users.lastName,
  email: users.email,
  phone: users.phone,
};

export async function getTutorJoinRows() {
  const db = await getDb();

  return db.select(tutorJoinSelect).from(tutors).innerJoin(users, eq(tutors.userId, users.id)).orderBy(asc(tutors.id));
}

export async function getTutorJoinRowById(tutorId: number) {
  const db = await getDb();

  const [row] = await db
    .select(tutorJoinSelect)
    .from(tutors)
    .innerJoin(users, eq(tutors.userId, users.id))
    .where(eq(tutors.id, tutorId))
    .limit(1);

  return row;
}

export async function getTutorProfileRowsByIds(tutorIds: number[]) {
  const db = await getDb();

  return db
    .select({
      id: tutors.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phone: users.phone,
    })
    .from(tutors)
    .innerJoin(users, eq(tutors.userId, users.id))
    .where(inArray(tutors.id, tutorIds))
    .orderBy(asc(tutors.id));
}

export async function getTutorOptionRowsByIds(tutorIds: number[]) {
  const db = await getDb();

  return db
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
    .where(inArray(tutors.id, tutorIds))
    .orderBy(asc(tutors.id), asc(availability.weekDay), asc(availability.startTime), asc(availability.endTime));
}

export async function getTutorSubjectRow(tutorId: number, subjectId: number) {
  const db = await getDb();
  const [row] = await db
    .select({ id: tutorSubjects.id })
    .from(tutorSubjects)
    .where(and(eq(tutorSubjects.tutorId, tutorId), eq(tutorSubjects.subjectId, subjectId)))
    .limit(1);

  return row ?? null;
}

export async function getTutorAvailabilityRows(tutorId: number) {
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
