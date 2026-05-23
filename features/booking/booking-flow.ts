import { slotUnitsToMinutes } from '@/features/credits/billing-units';
import type { AvailableSession } from '@/lib/validators/sessions';
import type { StudentOption, TutorOption } from './types';

export type BookingProgressStep = 'student' | 'subject' | 'tutor' | 'date' | 'credits';

const stepLabels: Record<BookingProgressStep, string> = {
  student: 'Choose a student',
  subject: 'Choose a subject',
  tutor: 'Choose a tutor',
  date: 'Choose a date and time',
  credits: 'Add credits',
};

export function shouldStartAtSubjectStep(students: StudentOption[]) {
  return students.length === 1;
}

export function getBookingProgress(step: BookingProgressStep, studentCount: number) {
  const baseSteps: BookingProgressStep[] =
    studentCount === 1 ? ['subject', 'tutor', 'date'] : ['student', 'subject', 'tutor', 'date'];
  const steps: BookingProgressStep[] = step === 'credits' ? [...baseSteps, 'credits'] : baseSteps;
  const currentStep = steps.indexOf(step);

  if (currentStep === -1) {
    throw new Error(`Unsupported booking step "${step}" for student count ${studentCount}`);
  }

  return {
    currentStep: currentStep + 1,
    totalSteps: steps.length,
    currentStepLabel: stepLabels[step],
    stepLabels: steps.map(stepName => stepLabels[stepName]),
  };
}

type SubjectSelectionLike = {
  assignments: Array<{ tutorId: number }>;
};

export function selectTutorsForSubject(tutors: TutorOption[], selection: SubjectSelectionLike) {
  const tutorIds = new Set(selection.assignments.map(assignment => assignment.tutorId));
  return tutors.filter(tutor => tutorIds.has(tutor.id));
}

export function getSessionSlotUnits(session: AvailableSession) {
  const durationMinutes =
    (new Date(session.ends_at).getTime() - new Date(session.scheduled_at).getTime()) / (1000 * 60);

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
