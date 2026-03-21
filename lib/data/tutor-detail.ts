import 'server-only';
import { notFound } from 'next/navigation';
import { tutors, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import { TutorWithJoinsSchema, type TutorWithJoins } from '@/lib/validators/tutors';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export { getUserRole } from '@/lib/auth';

export type TutorDetailType = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  education: string;
  bio: string;
  tagline: string;
  verified: boolean;
  years_experience: number;
};

const mapTutorDetail = (tutor: TutorWithJoins): TutorDetailType => {
  const user = pickFirstEmbedded(tutor.users);

  return {
    id: tutor.id,
    user_id: tutor.user_id,
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '—',
    education: tutor.education ?? '—',
    bio: tutor.bio ?? '—',
    tagline: tutor.tagline ?? '—',
    verified: tutor.verified,
    years_experience: tutor.years_experience ?? 0,
  };
};

type TutorDetailRow = {
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

const mapTutorJoinRow = (row: TutorDetailRow): TutorWithJoins => ({
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

export async function getTutor(id: number): Promise<TutorDetailType> {
  let row: TutorDetailRow | undefined;
  try {
    const db = await getDb();
    [row] = await db
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
      .where(eq(tutors.id, id))
      .limit(1);
  } catch {
    notFound();
  }

  if (!row) {
    notFound();
  }

  const parsedTutor = TutorWithJoinsSchema.safeParse(mapTutorJoinRow(row));
  if (!parsedTutor.success) {
    notFound();
  }

  return mapTutorDetail(parsedTutor.data);
}
