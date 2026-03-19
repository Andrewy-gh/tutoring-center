import 'server-only';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from './client';
import { creditBalances, creditTransactions, sessions, students, type SessionStatus } from './schema';

const FREE_SLOT_STATUSES: SessionStatus[] = ['Canceled', 'Rescheduled'];
const DEFAULT_SESSION_STATUS: SessionStatus = 'Scheduled';

export type BookSessionInput = {
  tutorId: number;
  studentId: number;
  subjectId: number;
  parentId: number;
  slotUnits: number;
  scheduledAt: string;
  endsAt: string;
  status?: SessionStatus;
};

export class SessionOverlapError extends Error {
  constructor() {
    super('Tutor already has a session in that time range');
    this.name = 'SessionOverlapError';
  }
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits');
    this.name = 'InsufficientCreditsError';
  }
}

export class ParentStudentMismatchError extends Error {
  constructor() {
    super('Student does not belong to parent');
    this.name = 'ParentStudentMismatchError';
  }
}

export class CreditBalanceNotFoundError extends Error {
  constructor() {
    super('No credit balance found for parent');
    this.name = 'CreditBalanceNotFoundError';
  }
}

function isDatabaseError(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export async function bookSession(input: BookSessionInput, database = db) {
  const status = input.status ?? DEFAULT_SESSION_STATUS;

  try {
    return await database.transaction(async tx => {
      const ownedStudent = await tx
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.id, input.studentId), eq(students.parentId, input.parentId)))
        .limit(1);

      if (ownedStudent.length === 0) {
        throw new ParentStudentMismatchError();
      }

      const overlapping = await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.tutorId, input.tutorId),
            ne(sessions.status, FREE_SLOT_STATUSES[0]),
            ne(sessions.status, FREE_SLOT_STATUSES[1]),
            sql`tstzrange(${sessions.scheduledAt}, ${sessions.endsAt}, '[)') && tstzrange(${input.scheduledAt}::timestamptz, ${input.endsAt}::timestamptz, '[)')`
          )
        )
        .limit(1);

      if (overlapping.length > 0) {
        throw new SessionOverlapError();
      }

      const [session] = await tx
        .insert(sessions)
        .values({
          tutorId: input.tutorId,
          studentId: input.studentId,
          subjectId: input.subjectId,
          parentId: input.parentId,
          slotUnits: input.slotUnits,
          scheduledAt: input.scheduledAt,
          endsAt: input.endsAt,
          status,
        })
        .returning({
          id: sessions.id,
          tutor_id: sessions.tutorId,
          student_id: sessions.studentId,
          subject_id: sessions.subjectId,
          parent_id: sessions.parentId,
          slot_units: sessions.slotUnits,
          scheduled_at: sessions.scheduledAt,
          ends_at: sessions.endsAt,
          status: sessions.status,
        });

      const [balance] = await tx
        .update(creditBalances)
        .set({
          amountAvailable: sql`${creditBalances.amountAvailable} - ${input.slotUnits}`,
          amountPending: sql`${creditBalances.amountPending} + ${input.slotUnits}`,
          updatedAt: sql`now()`,
        })
        .where(
          and(eq(creditBalances.parentId, input.parentId), sql`${creditBalances.amountAvailable} >= ${input.slotUnits}`)
        )
        .returning({
          amountAvailable: creditBalances.amountAvailable,
          amountPending: creditBalances.amountPending,
        });

      if (!balance) {
        const existingBalance = await tx
          .select({ id: creditBalances.id })
          .from(creditBalances)
          .where(eq(creditBalances.parentId, input.parentId))
          .limit(1);

        if (existingBalance.length === 0) {
          throw new CreditBalanceNotFoundError();
        }

        throw new InsufficientCreditsError();
      }

      await tx.insert(creditTransactions).values({
        parentId: input.parentId,
        sessionId: session.id,
        availableDelta: input.slotUnits * -1,
        pendingDelta: input.slotUnits,
        availableAfter: balance.amountAvailable,
        pendingAfter: balance.amountPending,
        type: 'reservation',
      });

      return {
        session,
        balance: {
          amount_available: balance.amountAvailable,
          amount_pending: balance.amountPending,
        },
      };
    });
  } catch (error) {
    if (isDatabaseError(error) && error.code === '23P01' && error.constraint === 'sessions_tutor_time_overlap') {
      throw new SessionOverlapError();
    }

    throw error;
  }
}
