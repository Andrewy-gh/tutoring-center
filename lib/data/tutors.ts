import 'server-only';
import { forbidden } from 'next/navigation';
import { isValidRole } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import { tutors, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import { TutorWithJoinsListSchema, type TutorWithJoins } from '@/lib/validators/tutors';
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

const TUTOR_ERROR_MESSAGES = {
  admin: {
    database: 'Tutor data is temporarily unavailable. Please retry in a moment.',
    validation: 'Tutor data format is invalid. Please try again later.',
  },
} as const;

type TutorJoinRow = {
  id: unknown;
  userId: unknown;
  verified: unknown;
  education: unknown;
  bio: unknown;
  tagline: unknown;
  yearsExperience: unknown;
  firstName: unknown;
  lastName: unknown;
  email: unknown;
  phone: unknown;
};

const mapTutorJoinRow = (row: TutorJoinRow): TutorWithJoins => ({
  id: row.id as number,
  user_id: row.userId as number,
  verified: row.verified as boolean,
  education: row.education as string | null,
  bio: row.bio as string | null,
  tagline: row.tagline as string | null,
  years_experience: row.yearsExperience as number | null,
  users: {
    first_name: row.firstName as string | null,
    last_name: row.lastName as string | null,
    email: row.email as string,
    phone: row.phone as string | null,
  },
});

const parseTutorUser = (users: TutorWithJoins['users']) => {
  const user = pickFirstEmbedded(users);

  return {
    name: [user?.first_name, user?.last_name].filter(Boolean).join(' '),
    email: user?.email ?? '',
    phone: user?.phone ?? '—',
  };
};

const mapTutorRow = (
  tutor: Pick<TutorWithJoins, 'id' | 'user_id' | 'verified' | 'education' | 'years_experience' | 'users'>
) => {
  const user = parseTutorUser(tutor.users);

  return {
    id: tutor.id,
    user_id: tutor.user_id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    education: tutor.education ?? '—',
    verified: tutor.verified,
    years_experience: tutor.years_experience ?? 0,
  };
};

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
    throw new Error('Tutor data is temporarily unavailable. Please retry in a moment.');
  }

  return new Map(
    rows.map(tutor => {
      const user = pickFirstEmbedded({
        first_name: tutor.firstName as string | null,
        last_name: tutor.lastName as string | null,
        email: tutor.email as string,
        phone: tutor.phone as string | null,
      });

      return [
        tutor.id as number,
        {
          id: tutor.id as number,
          name: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—',
          email: user?.email ?? '',
          phone: user?.phone ?? '—',
        },
      ] satisfies [number, TutorProfile];
    })
  );
}

export async function getTutors(role: UserRole) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch tutors.');
  }

  if (role !== 'admin') {
    forbidden();
  }

  let rows: TutorJoinRow[];
  try {
    const db = await getDb();
    rows = await db
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

  const parsedTutors = TutorWithJoinsListSchema.safeParse(rows.map(mapTutorJoinRow));
  if (!parsedTutors.success) {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.validation);
  }

  return parsedTutors.data.map(mapTutorRow);
}
