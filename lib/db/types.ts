import type { InferInsertModel, InferSelectModel, Table } from 'drizzle-orm';
import {
  CANCELED_SESSION_STATUS,
  DEFAULT_SESSION_STATUS,
  FREE_SLOT_STATUSES,
  RESCHEDULED_SESSION_STATUS,
  SESSION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
  creditTransactions,
  parents,
  sessionProgress,
  sessions,
  students,
  tutors,
  users,
  type FreeSlotStatus,
  type SessionStatus,
  type TransactionType,
  type WeekDay,
} from './schema';

type DbSelectModel<TTable extends Table> = InferSelectModel<TTable, { dbColumnNames: true }>;
type DbInsertModel<TTable extends Table> = InferInsertModel<TTable, { dbColumnNames: true }>;

export {
  CANCELED_SESSION_STATUS,
  DEFAULT_SESSION_STATUS,
  FREE_SLOT_STATUSES,
  RESCHEDULED_SESSION_STATUS,
  SESSION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
};

export type { FreeSlotStatus, SessionStatus, TransactionType, WeekDay };

export type UserRow = DbSelectModel<typeof users>;
export type ParentRow = DbSelectModel<typeof parents>;
export type StudentRow = DbSelectModel<typeof students>;
export type TutorRow = DbSelectModel<typeof tutors>;
export type SessionRow = DbSelectModel<typeof sessions>;
export type SessionInsert = DbInsertModel<typeof sessions>;
export type SessionProgressRow = DbSelectModel<typeof sessionProgress>;
export type CreditTransactionRecord = DbSelectModel<typeof creditTransactions>;

export type EmbeddedUser = Pick<UserRow, 'first_name' | 'last_name' | 'email' | 'phone'>;
