import { sql } from 'drizzle-orm';
import { check, index, integer, pgEnum, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { parents } from './core';
import { sessions } from './scheduling';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'purchase',
  'reservation',
  'reservation_release',
  'session_debit',
  'refund',
  'adjustment',
  'cancellation_fee',
]);

export const creditBalances = pgTable(
  'credit_balances',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id')
      .notNull()
      .references(() => parents.id),
    availableMinutes: integer('available_minutes').notNull().default(0),
    pendingMinutes: integer('pending_minutes').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    index('credit_balances_available_minutes_idx').on(table.availableMinutes),
    unique('credit_balances_parent_id_unique').on(table.parentId),
    check('credit_balances_available_minutes_nonnegative', sql`${table.availableMinutes} >= 0`),
    check('credit_balances_pending_minutes_nonnegative', sql`${table.pendingMinutes} >= 0`),
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
    availableDeltaMinutes: integer('available_delta_minutes').notNull().default(0),
    pendingDeltaMinutes: integer('pending_delta_minutes').notNull().default(0),
    availableAfterMinutes: integer('available_after_minutes').notNull(),
    pendingAfterMinutes: integer('pending_after_minutes').notNull(),
    type: transactionTypeEnum('type').notNull(),
    idempotencyKey: text('idempotency_key'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    index('credit_transactions_type_session_id_idx').on(table.type, table.sessionId),
    index('credit_transactions_type_created_at_session_id_idx').on(table.type, table.createdAt, table.sessionId),
    unique('credit_transactions_idempotency_key_unique').on(table.idempotencyKey),
    check(
      'credit_transactions_nonzero_delta_minutes',
      sql`${table.availableDeltaMinutes} <> 0 or ${table.pendingDeltaMinutes} <> 0`
    ),
    check('credit_transactions_available_after_minutes_nonnegative', sql`${table.availableAfterMinutes} >= 0`),
    check('credit_transactions_pending_after_minutes_nonnegative', sql`${table.pendingAfterMinutes} >= 0`),
    check(
      'credit_transactions_valid_delta_shape_by_type_minutes',
      sql`case
        when ${table.type} = 'purchase' then ${table.availableDeltaMinutes} > 0 and ${table.pendingDeltaMinutes} = 0
        when ${table.type} = 'reservation'
          then ${table.availableDeltaMinutes} < 0
            and ${table.pendingDeltaMinutes} > 0
            and ${table.availableDeltaMinutes} + ${table.pendingDeltaMinutes} = 0
        when ${table.type} = 'reservation_release'
          then ${table.availableDeltaMinutes} > 0
            and ${table.pendingDeltaMinutes} < 0
            and ${table.availableDeltaMinutes} + ${table.pendingDeltaMinutes} = 0
        when ${table.type} = 'session_debit' then ${table.availableDeltaMinutes} = 0 and ${table.pendingDeltaMinutes} < 0
        when ${table.type} = 'cancellation_fee'
          then ${table.availableDeltaMinutes} = 0 and ${table.pendingDeltaMinutes} < 0
        else true
      end`
    ),
  ]
);
