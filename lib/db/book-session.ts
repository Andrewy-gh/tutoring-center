import 'server-only';
import { slotUnitsToMinutes } from '@/lib/billing-units';
import { sql, type SQL } from 'drizzle-orm';
import { db } from './client';
import { DEFAULT_SESSION_STATUS, FREE_SLOT_STATUSES, type SessionStatus } from './schema';

type SqlExecutor = {
  execute(query: SQL): Promise<unknown>;
};

export type BookSessionDatabase = SqlExecutor & {
  transaction<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T>;
};

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

export class InvalidSessionTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSessionTimeError';
  }
}

function isDatabaseError(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function validateSessionInput(input: BookSessionInput) {
  if (input.slotUnits <= 0) {
    throw new InvalidSessionTimeError('slot_units must be positive');
  }

  const start = new Date(input.scheduledAt);
  const end = new Date(input.endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new InvalidSessionTimeError('scheduled_at and ends_at must be valid ISO datetimes');
  }

  if (end <= start) {
    throw new InvalidSessionTimeError('ends_at must be after scheduled_at');
  }

  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  if (durationMinutes !== input.slotUnits * 30) {
    throw new InvalidSessionTimeError('slot_units must match the scheduled time range');
  }
}

function overlapStatusPredicate() {
  return sql`status <> ${FREE_SLOT_STATUSES[0]} and status <> ${FREE_SLOT_STATUSES[1]}`;
}

function mapInvalidSessionConstraint(constraint?: string) {
  if (constraint === 'sessions_ends_after_start') {
    return new InvalidSessionTimeError('ends_at must be after scheduled_at');
  }

  if (constraint === 'sessions_slot_units_positive') {
    return new InvalidSessionTimeError('slot_units must be positive');
  }

  if (constraint === 'sessions_slot_units_match_range') {
    return new InvalidSessionTimeError('slot_units must match the scheduled time range');
  }

  return null;
}

export async function bookSession(input: BookSessionInput, database: BookSessionDatabase = db as BookSessionDatabase) {
  validateSessionInput(input);
  const status = input.status ?? DEFAULT_SESSION_STATUS;
  const sessionMinutes = slotUnitsToMinutes(input.slotUnits);

  try {
    return await database.transaction(async tx => {
      const ownedStudent = (await tx.execute(sql`
        select id
        from students
        where id = ${input.studentId}
          and parent_id = ${input.parentId}
        limit 1
      `)) as Array<{ id: number }>;

      if (ownedStudent.length === 0) {
        throw new ParentStudentMismatchError();
      }

      const overlapping = (await tx.execute(sql`
        select id
        from sessions
        where tutor_id = ${input.tutorId}
          and ${overlapStatusPredicate()}
          and tstzrange(scheduled_at, ends_at, '[)') && tstzrange(${input.scheduledAt}::timestamptz, ${input.endsAt}::timestamptz, '[)')
        limit 1
      `)) as Array<{ id: number }>;

      if (overlapping.length > 0) {
        throw new SessionOverlapError();
      }

      const [session] = (await tx.execute(sql`
        insert into sessions (
          tutor_id,
          student_id,
          subject_id,
          parent_id,
          slot_units,
          scheduled_at,
          ends_at,
          status
        )
        values (
          ${input.tutorId},
          ${input.studentId},
          ${input.subjectId},
          ${input.parentId},
          ${input.slotUnits},
          ${input.scheduledAt}::timestamptz,
          ${input.endsAt}::timestamptz,
          ${status}
        )
        returning id, tutor_id, student_id, subject_id, parent_id, slot_units, scheduled_at, ends_at, status
      `)) as Array<{
        id: number;
        tutor_id: number;
        student_id: number;
        subject_id: number;
        parent_id: number;
        slot_units: number;
        scheduled_at: string;
        ends_at: string;
        status: SessionStatus;
      }>;

      const [balance] = (await tx.execute(sql`
        update credit_balances
        set
          available_minutes = available_minutes - ${sessionMinutes},
          pending_minutes = pending_minutes + ${sessionMinutes},
          updated_at = now()
        where parent_id = ${input.parentId}
          and available_minutes >= ${sessionMinutes}
        returning available_minutes, pending_minutes
      `)) as Array<{ available_minutes: number; pending_minutes: number }>;

      if (!balance) {
        const existingBalance = (await tx.execute(sql`
          select id
          from credit_balances
          where parent_id = ${input.parentId}
          limit 1
        `)) as Array<{ id: number }>;

        if (existingBalance.length === 0) {
          throw new CreditBalanceNotFoundError();
        }

        throw new InsufficientCreditsError();
      }

      await tx.execute(sql`
        insert into credit_transactions (
          parent_id,
          session_id,
          available_delta_minutes,
          pending_delta_minutes,
          available_after_minutes,
          pending_after_minutes,
          type
        )
        values (
          ${input.parentId},
          ${session.id},
          ${sessionMinutes * -1},
          ${sessionMinutes},
          ${balance.available_minutes},
          ${balance.pending_minutes},
          'reservation'
        )
      `);

      return {
        session,
        balance: {
          available_minutes: balance.available_minutes,
          pending_minutes: balance.pending_minutes,
        },
      };
    });
  } catch (error) {
    if (isDatabaseError(error) && error.code === '23P01' && error.constraint === 'sessions_tutor_time_overlap') {
      throw new SessionOverlapError();
    }

    if (isDatabaseError(error) && error.code === '23514') {
      const invalidSessionError = mapInvalidSessionConstraint(error.constraint);
      if (invalidSessionError) {
        throw invalidSessionError;
      }
    }

    throw error;
  }
}
