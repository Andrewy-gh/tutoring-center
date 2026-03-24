import { TRANSACTION_TYPE_OPTIONS, type TransactionType } from '@/lib/db/types';
import { z } from 'zod';
import { id, isoDateTime, page, pageSize } from './shared';

export { TRANSACTION_TYPE_OPTIONS };
export type { TransactionType };
export const TransactionTypeSchema = z.enum(TRANSACTION_TYPE_OPTIONS);
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  purchase: 'Purchase',
  reservation: 'Reservation',
  reservation_release: 'Reservation Release',
  session_debit: 'Session Debit',
  refund: 'Refund',
  adjustment: 'Adjustment',
  cancellation_fee: 'Cancellation Fee',
};
export const TRANSACTION_TYPE_FILTER_OPTIONS = TRANSACTION_TYPE_OPTIONS.map(value => ({
  value,
  label: TRANSACTION_TYPE_LABELS[value],
}));

export function formatTransactionTypeLabel(type: TransactionType) {
  return TRANSACTION_TYPE_LABELS[type];
}

export const TransactionCreateSchema = z
  .object({
    parent_id: id,
    session_id: id.optional(),
    available_delta: z.number().int(),
    pending_delta: z.number().int(),
    available_after: z.number().nonnegative().int(),
    pending_after: z.number().nonnegative().int(),
    idempotency_key: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    type: TransactionTypeSchema,
  })
  .refine(input => input.available_delta !== 0 || input.pending_delta !== 0, {
    message: 'At least one ledger delta must be non-zero',
    path: ['available_delta'],
  });

export const TransactionListQuerySchema = z.object({
  parent_id: id.optional(),
  student_id: id.optional(),
  session_id: id.optional(),
  type: z.enum(['all', ...TRANSACTION_TYPE_OPTIONS]).default('all'),
  start_date: isoDateTime.optional(),
  end_date: isoDateTime.optional(),
  page,
  page_size: pageSize,
});

// Output validation for sessions + joins, wasn't exported so i copied it here for transactions. Should probably be moved to a shared file if we need it in multiple places
const EmbeddedRecordSchema = z.record(z.unknown());
const EmbeddedOneSchema = z.union([EmbeddedRecordSchema, z.array(EmbeddedRecordSchema), z.null()]).optional();

export const TransactionsWithJoinsSchema = z.object({
  id: z.number(),
  parent_id: z.number(),
  session_id: z.number().nullable(),
  available_delta: z.number().int(),
  pending_delta: z.number().int(),
  available_after: z.number().nonnegative().int(),
  pending_after: z.number().nonnegative().int(),
  type: TransactionTypeSchema,
  created_at: z.string(), // ISO date string
  idempotency_key: z.string().nullable().optional(),
  note: z.string().nullable().optional(),

  parent: EmbeddedOneSchema,
  session: EmbeddedOneSchema,
});

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>;
export type TransactionListQueryInput = z.infer<typeof TransactionListQuerySchema>;

export const TransactionsWithJoinsListSchema = z.array(TransactionsWithJoinsSchema);
export type TransactionsWithJoins = z.infer<typeof TransactionsWithJoinsSchema>;
