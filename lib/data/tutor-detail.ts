import 'server-only';
import { notFound } from 'next/navigation';
import { tutors, users } from '@/db/schema';
import { TutorJoinRowSchema, type TutorJoinRow } from '@/lib/validators/tutors';
import { eq } from 'drizzle-orm';

async function getDb() {
  return (await import('@/db/client')).db;
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

const MISSING_VALUE = '—';

const mapTutorDetail = (tutor: TutorJoinRow) => ({
  id: tutor.id,
  user_id: tutor.userId,
  first_name: tutor.firstName ?? '',
  last_name: tutor.lastName ?? '',
  email: tutor.email,
  phone: tutor.phone ?? MISSING_VALUE,
  education: tutor.education ?? MISSING_VALUE,
  bio: tutor.bio ?? MISSING_VALUE,
  tagline: tutor.tagline ?? MISSING_VALUE,
  verified: tutor.verified,
  years_experience: tutor.yearsExperience ?? 0,
});

export async function getTutor(id: number) {
  let rawRow: unknown;
  try {
    const db = await getDb();
    [rawRow] = await db
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

  const parsedTutor = TutorJoinRowSchema.safeParse(rawRow);
  if (!parsedTutor.success) {
    notFound();
  }

  return mapTutorDetail(parsedTutor.data);
}
