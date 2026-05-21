import 'server-only';
import { availability, tutors, users } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';

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
