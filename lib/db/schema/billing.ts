import { sql } from 'drizzle-orm';
import { check, integer, pgEnum, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { parents } from './core';
import { sessions } from './scheduling';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'Purchase',
  'Reservation',
  'Reservation Release',
  'Session Debit',
  'Refund',
  'Adjustment',
  'Cancellation Fee',
]);

export const creditBalances = pgTable(
  'credit_balances',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id')
      .notNull()
      .references(() => parents.id),
    amountAvailable: integer('amount_available').notNull().default(0),
    amountPending: integer('amount_pending').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    unique('credit_balances_parent_id_unique').on(table.parentId),
    check('credit_balances_available_nonnegative', sql`${table.amountAvailable} >= 0`),
    check('credit_balances_pending_nonnegative', sql`${table.amountPending} >= 0`),
  ]
);

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id')
      .notNull()
      .references(() => parents.id),
    sessionId: integer('session_id').references(() => sessions.id),
    availableDelta: integer('available_delta').notNull().default(0),
    pendingDelta: integer('pending_delta').notNull().default(0),
    availableAfter: integer('available_after').notNull(),
    pendingAfter: integer('pending_after').notNull(),
    type: transactionTypeEnum('type').notNull(),
    idempotencyKey: text('idempotency_key'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    unique('credit_transactions_idempotency_key_unique').on(table.idempotencyKey),
    check(
      'credit_transactions_nonzero_delta',
      sql`${table.availableDelta} <> 0 or ${table.pendingDelta} <> 0`
    ),
    check('credit_transactions_available_after_nonnegative', sql`${table.availableAfter} >= 0`),
    check('credit_transactions_pending_after_nonnegative', sql`${table.pendingAfter} >= 0`),
  ]
);
