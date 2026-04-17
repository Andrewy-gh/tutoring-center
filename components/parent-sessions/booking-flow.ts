import type { StudentOption } from '@/components/parent-sessions/pick-student';
import type { TutorOption } from '@/components/parent-sessions/pick-tutors';
import { slotUnitsToMinutes } from '@/lib/billing-units';
import type { AvailableSession } from '@/lib/validators/sessions';

export type Reservation = {
  student: StudentOption;
  subject: { id: number; slug: string; name: string };
  tutor: TutorOption;
  session: AvailableSession;
};

export function shouldStartAtSubjectStep(students: StudentOption[]) {
  return students.length === 1;
}

type SubjectSelectionLike = {
  assignments: Array<{ tutorId: number }>;
};

export function selectTutorsForSubject(tutors: TutorOption[], selection: SubjectSelectionLike) {
  const tutorIds = new Set(selection.assignments.map(assignment => assignment.tutorId));
  return tutors.filter(tutor => tutorIds.has(tutor.id));
}

export function getSessionSlotUnits(session: AvailableSession) {
  const durationMinutes = (new Date(session.ends_at).getTime() - new Date(session.scheduled_at).getTime()) / (1000 * 60);

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes % 30 !== 0) {
    throw new Error('Selected session duration must be a positive multiple of 30 minutes');
  }

  return durationMinutes / 30;
}

export function getSessionDurationMinutes(session: AvailableSession) {
  return slotUnitsToMinutes(getSessionSlotUnits(session));
}

export function shouldBlockForCredits(availableMinutes: number, requiredMinutes: number) {
  return availableMinutes < requiredMinutes;
}
