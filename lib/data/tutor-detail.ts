import 'server-only';
import { tutorDataService } from '@/features/tutors/tutors-service';

export { getUserRole } from '@/features/tutors/tutors-service';
export type { TutorDetailType } from '@/features/tutors/tutors-service';

export async function getTutor(id: Parameters<typeof tutorDataService.getTutor>[0]) {
  return tutorDataService.getTutor(id);
}
