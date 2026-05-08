import type { AvailableSession } from '@/lib/validators/sessions';

export type StudentOption = {
  id: number;
  name: string;
  grade: string | null;
};

export type TutorOption = {
  id: number;
  user_id: number;
  name: string;
  education: string | null;
  years_experience: number | null;
  typicalAvailability: string | null;
};

export type Reservation = {
  student: StudentOption;
  subject: { id: number; slug: string; name: string };
  tutor: TutorOption;
  session: AvailableSession;
};
