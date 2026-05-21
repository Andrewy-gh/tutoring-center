import 'server-only';
import { tutorDataService } from '@/features/tutors/tutors-service';

export { getUserRole } from '@/features/tutors/tutors-service';
export type { TutorProfile, TutorRow } from '@/features/tutors/tutors-service';

export async function getTutorProfileMapByIds(
  tutorIds: Parameters<typeof tutorDataService.getTutorProfileMapByIds>[0]
) {
  return tutorDataService.getTutorProfileMapByIds(tutorIds);
}

export async function getTutors(role: Parameters<typeof tutorDataService.getTutors>[0]) {
  return tutorDataService.getTutors(role);
}
