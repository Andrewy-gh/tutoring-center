import 'server-only';
import { forbidden } from 'next/navigation';
import { isValidRole } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import { tutors, users } from '@/lib/db/schema';
import { TutorJoinRowListSchema, type TutorJoinRow } from '@/lib/validators/tutors';
import { asc, eq, inArray } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export { getUserRole } from '@/lib/auth';

export type TutorRow = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  phone: string;
  education: string;
  verified: boolean;
  years_experience: number;
};

export type TutorProfile = {
  id: number;
  name: string;
  email: string;
  phone: string;
};

const MISSING_VALUE = '—';

const TUTOR_ERROR_MESSAGES = {
  admin: {
    database: 'Tutor data is temporarily unavailable. Please retry in a moment.',
    validation: 'Tutor data format is invalid. Please try again later.',
  },
} as const;

const mapTutorRow = (tutor: TutorJoinRow): TutorRow => ({
  id: tutor.id,
  user_id: tutor.userId,
  name: [tutor.firstName, tutor.lastName].filter(Boolean).join(' '),
  email: tutor.email,
  phone: tutor.phone ?? MISSING_VALUE,
  education: tutor.education ?? MISSING_VALUE,
  verified: tutor.verified,
  years_experience: tutor.yearsExperience ?? 0,
});

export async function getTutorProfileMapByIds(tutorIds: number[]) {
  const uniqueTutorIds = [...new Set(tutorIds.filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueTutorIds.length === 0) {
    return new Map<number, TutorProfile>();
  }

  let rows: Array<Pick<TutorJoinRow, 'id' | 'firstName' | 'lastName' | 'email' | 'phone'>>;
  try {
    const db = await getDb();
    rows = await db
      .select({
        id: tutors.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(tutors)
      .innerJoin(users, eq(tutors.userId, users.id))
      .where(inArray(tutors.id, uniqueTutorIds))
      .orderBy(asc(tutors.id));
  } catch {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.database);
  }

  return new Map(
    rows.map(tutor => [
      tutor.id,
      {
        id: tutor.id,
        name: [tutor.firstName, tutor.lastName].filter(Boolean).join(' ') || MISSING_VALUE,
        email: tutor.email,
        phone: tutor.phone ?? MISSING_VALUE,
      },
    ])
  );
}

export async function getTutors(role: UserRole) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch tutors.');
  }

  if (role !== 'admin') {
    forbidden();
  }

  let rawRows: unknown;
  try {
    const db = await getDb();
    rawRows = await db
      .select({
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
      })
      .from(tutors)
      .innerJoin(users, eq(tutors.userId, users.id))
      .orderBy(asc(tutors.id));
  } catch {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.database);
  }

  const parsedTutors = TutorJoinRowListSchema.safeParse(rawRows);
  if (!parsedTutors.success) {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.validation);
  }

  return parsedTutors.data.map(mapTutorRow);
}
