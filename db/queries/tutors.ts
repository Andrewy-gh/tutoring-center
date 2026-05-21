import 'server-only';
import { tutors, users } from '@/db/schema';
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
