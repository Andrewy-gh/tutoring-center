import {
  bookSession,
  CreditBalanceNotFoundError,
  InsufficientCreditsError,
  InvalidSessionTimeError,
  ParentStudentMismatchError,
  SessionOverlapError,
  type BookSessionDatabase,
} from '@/lib/db/book-session';
import { db } from '@/lib/db/client';

function isBookSessionDatabase(value: unknown): value is BookSessionDatabase {
  return (
    typeof value === 'object' &&
    value !== null &&
    'execute' in value &&
    typeof value.execute === 'function' &&
    'transaction' in value &&
    typeof value.transaction === 'function'
  );
}

function resolveDatabase(database?: unknown): BookSessionDatabase {
  return isBookSessionDatabase(database) ? database : (db as BookSessionDatabase);
}

function getSlotUnits(scheduled_at: string, ends_at: string) {
  const start_time = new Date(scheduled_at);
  const end_time = new Date(ends_at);

  if (Number.isNaN(start_time.getTime()) || Number.isNaN(end_time.getTime())) {
    throw new InvalidSessionTimeError('scheduled_at and ends_at must be valid ISO datetimes');
  }

  if (end_time <= start_time) {
    throw new InvalidSessionTimeError('End time must be after start time');
  }

  const durationMinutes = (end_time.getTime() - start_time.getTime()) / (1000 * 60);
  const slotUnits = durationMinutes / 30;

  if (!Number.isInteger(slotUnits) || slotUnits <= 0) {
    throw new InvalidSessionTimeError('Session duration must be a positive multiple of 30 minutes');
  }

  return slotUnits;
}

/**
 * Places a tutoring session reservation for a student with a tutor in a specific subject at a scheduled time. The function calculates the duration of the session and determines the number of slot units based on 30-minute intervals. It then inserts the session details into the 'sessions' table in the database and returns the inserted session data or an error if the query fails.
 * @param parent_id: The id of the parent making the reservation
 * @param student_id: The id of the student for whom the reservation is being made
 * @param tutor_id: The id of the tutor with whom the session is being scheduled
 * @param subject_id: The id of the subject for which the session is being scheduled
 * @param scheduled_at: The scheduled start time of the session in ISO 8601 format
 * @param ends_at: The scheduled end time of the session in ISO 8601 format
 * @param database: optional Drizzle db/tx; non-Drizzle values are ignored
 * @returns The scheduled session or an error if the query fails
 */
export async function placeSession(
  parent_id: number,
  student_id: number,
  tutor_id: number,
  subject_id: number,
  scheduled_at: string,
  ends_at: string,
  database?: unknown
) {
  try {
    const slotUnits = getSlotUnits(scheduled_at, ends_at);
    const { session } = await bookSession(
      {
        parentId: parent_id,
        studentId: student_id,
        tutorId: tutor_id,
        subjectId: subject_id,
        slotUnits,
        scheduledAt: scheduled_at,
        endsAt: ends_at,
      },
      resolveDatabase(database)
    );

    return { data: session, error: null };
  } catch (error) {
    if (
      error instanceof InvalidSessionTimeError ||
      error instanceof SessionOverlapError ||
      error instanceof InsufficientCreditsError ||
      error instanceof CreditBalanceNotFoundError ||
      error instanceof ParentStudentMismatchError
    ) {
      return { data: null, error };
    }

    return {
      data: null,
      error: error instanceof Error ? error : new Error('Failed to place session'),
    };
  }
}

export {
  CreditBalanceNotFoundError,
  InsufficientCreditsError,
  InvalidSessionTimeError,
  ParentStudentMismatchError,
  SessionOverlapError,
};
