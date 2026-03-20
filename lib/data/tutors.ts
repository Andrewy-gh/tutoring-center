import 'server-only';
import { forbidden } from 'next/navigation';
import { isValidRole } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import { tutors, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import { TutorWithJoinsListSchema, type TutorWithJoins } from '@/lib/validators/tutors';
import { eq, inArray } from 'drizzle-orm';

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

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

type TutorJoinRow = {
  id: number;
  user_id: number;
  verified: boolean;
  education: string | null;
  bio: string | null;
  tagline: string | null;
  years_experience: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
};

function mapTutorJoinRow(row: TutorJoinRow): TutorWithJoins {
  return {
    id: row.id,
    user_id: row.user_id,
    verified: row.verified,
    education: row.education,
    bio: row.bio,
    tagline: row.tagline,
    years_experience: row.years_experience,
    users: {
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone,
    },
  };
}

export async function getTutorProfileMapByIds(tutorIds: number[]) {
  const uniqueTutorIds = [...new Set(tutorIds.filter(id => Number.isInteger(id) && id > 0))];
  if (uniqueTutorIds.length === 0) {
    return new Map<number, TutorProfile>();
  }

  const db = await getDb();
  let rows: Array<{
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
    phone: string | null;
  }>;
  try {
    rows = await db
      .select({
        id: tutors.id,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(tutors)
      .innerJoin(users, eq(tutors.userId, users.id))
      .where(inArray(tutors.id, uniqueTutorIds));
  } catch {
    throw new Error('Tutor data is temporarily unavailable. Please retry in a moment.');
  }

  return new Map(
    rows.map(tutor => {
      const user = pickFirstEmbedded({
        first_name: tutor.first_name,
        last_name: tutor.last_name,
        email: tutor.email,
        phone: tutor.phone,
      });

      return [
        tutor.id,
        {
          id: tutor.id,
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

  const db = await getDb();
  let rows: TutorJoinRow[];
  try {
    rows = await db
      .select({
        id: tutors.id,
        user_id: tutors.userId,
        verified: tutors.verified,
        education: tutors.education,
        bio: tutors.bio,
        tagline: tutors.tagline,
        years_experience: tutors.yearsExperience,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(tutors)
      .innerJoin(users, eq(tutors.userId, users.id));
  } catch {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.database);
  }

  const parsedTutors = TutorWithJoinsListSchema.safeParse(rows.map(mapTutorJoinRow));
  if (!parsedTutors.success) {
    throw new Error(TUTOR_ERROR_MESSAGES.admin.validation);
  }

  return parsedTutors.data.map(mapTutorRow);
}
