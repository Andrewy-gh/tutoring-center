import { integer, pgEnum, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import { parents, students, subjects, tutors } from './core';

export const sessionStatusEnum = pgEnum('session_status', [
  'Scheduled',
  'Pending-Notes',
  'Completed',
  'Canceled',
  'No-show',
  'Rescheduled',
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'Purchase',
  'Session Debit',
  'Refund',
  'Adjustment',
  'Cancellation Fee',
]);

export type SessionStatus = (typeof sessionStatusEnum.enumValues)[number];

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id')
    .notNull()
    .references(() => parents.id),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  tutorId: integer('tutor_id')
    .notNull()
    .references(() => tutors.id),
  subjectId: integer('subject_id')
    .notNull()
    .references(() => subjects.id),
  slotUnits: integer('slot_units').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'string' }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }).notNull(),
  status: sessionStatusEnum('status').notNull().default('Scheduled'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const creditBalances = pgTable('credit_balances', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id')
    .notNull()
    .references(() => parents.id),
  amountAvailable: integer('amount_available').notNull(),
  amountPending: integer('amount_pending').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id')
    .notNull()
    .references(() => parents.id),
  sessionId: integer('session_id').references(() => sessions.id),
  studentId: integer('student_id')
    .notNull()
    .references(() => students.id),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  type: transactionTypeEnum('type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});
