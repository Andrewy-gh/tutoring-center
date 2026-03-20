import 'server-only';
import { notFound } from 'next/navigation';
import { tutors, users } from '@/lib/db/schema';
import { pickFirstEmbedded } from '@/lib/utils/normalize';
import { TutorWithJoinsSchema, type TutorWithJoins } from '@/lib/validators/tutors';
import { eq } from 'drizzle-orm';

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

async function getDb() {
  return (await import('@/lib/db/client')).db;
}

export async function getTutor(id: number): Promise<TutorDetailType> {
  const db = await getDb();

  let rows: Array<{
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
  }>;
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
      .innerJoin(users, eq(tutors.userId, users.id))
      .where(eq(tutors.id, id))
      .limit(1);
  } catch {
    notFound();
  }

  const [row] = rows;
  if (!row) {
    notFound();
  }

  const parsedTutor = TutorWithJoinsSchema.safeParse({
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
  });
  if (!parsedTutor.success) {
    notFound();
  }

  return mapTutorDetail(parsedTutor.data);
}
