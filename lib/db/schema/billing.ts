import { integer, pgEnum, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import { parents, students } from './core';
import { sessions } from './scheduling';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'Purchase',
  'Session Debit',
  'Refund',
  'Adjustment',
  'Cancellation Fee',
]);

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
