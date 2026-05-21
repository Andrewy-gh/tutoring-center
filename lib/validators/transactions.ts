import { SESSION_STATUS_OPTIONS, TRANSACTION_TYPE_OPTIONS, type TransactionType } from '@/db/types';
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
    available_delta_minutes: z.number().int(),
    pending_delta_minutes: z.number().int(),
    available_after_minutes: z.number().nonnegative().int(),
    pending_after_minutes: z.number().nonnegative().int(),
    idempotency_key: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
    type: TransactionTypeSchema,
  })
  .refine(input => input.available_delta_minutes !== 0 || input.pending_delta_minutes !== 0, {
    message: 'At least one ledger delta must be non-zero',
    path: ['available_delta_minutes'],
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

const SessionStatusSchema = z.enum(SESSION_STATUS_OPTIONS);

export const CreditTransactionListQueryRowSchema = z.object({
  id: z.number(),
  parent_id: z.number(),
  session_id: z.number().nullable(),
  available_delta_minutes: z.number().int(),
  pending_delta_minutes: z.number().int(),
  available_after_minutes: z.number().nonnegative().int(),
  pending_after_minutes: z.number().nonnegative().int(),
  type: TransactionTypeSchema,
  created_at: z.string(), // ISO date string
  idempotency_key: z.string().nullable(),
  note: z.string().nullable(),
  parent_first_name: z.string().nullable(),
  parent_last_name: z.string().nullable(),
  session_subject_id: z.number().nullable(),
  session_tutor_id: z.number().nullable(),
  scheduled_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  status: SessionStatusSchema.nullable(),
  student_id: z.number().nullable(),
  student_user_id: z.number().nullable(),
  student_grade: z.string().nullable(),
  student_first_name: z.string().nullable(),
  student_last_name: z.string().nullable(),
  student_email: z.string().nullable(),
  student_phone: z.string().nullable(),
});

export type TransactionCreateInput = z.infer<typeof TransactionCreateSchema>;
export type TransactionListQueryInput = z.infer<typeof TransactionListQuerySchema>;

export const CreditTransactionListQueryRowListSchema = z.array(CreditTransactionListQueryRowSchema);
export type CreditTransactionListQueryRow = z.infer<typeof CreditTransactionListQueryRowSchema>;
