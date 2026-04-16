import { SESSION_STATUS_OPTIONS, type SessionStatus } from '@/lib/db/types';
import { z } from 'zod';
import { id, isoDateTime, page, pageSize, units1to100 } from './shared';

export { SESSION_STATUS_OPTIONS };
export type { SessionStatus };

export const StatusSchema = z.enum(SESSION_STATUS_OPTIONS);

export const SessionCreateSchema = z
  .object({
    tutor_id: id,
    student_id: id,
    subject_id: id,
    parent_id: id.optional(), // parents get id through cookie

    slot_units: units1to100,

    scheduled_at: isoDateTime,
    ends_at: isoDateTime,

    status: StatusSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const start = new Date(v.scheduled_at);
    const end = new Date(v.ends_at);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ends_at must be after scheduled_at',
        path: ['ends_at'],
      });
      return;
    }

    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (durationMinutes !== v.slot_units * 30) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'slot_units must match the scheduled time range',
        path: ['slot_units'],
      });
    }
  });

export const SessionListQuerySchema = z.object({
  kind: z.enum(['all', 'upcoming', 'past']).default('all'),

  parent_id: id.optional(),
  tutor_id: id.optional(),
  student_id: id.optional(),
  subject_id: id.optional(),

  status: StatusSchema.optional(),

  page,
  page_size: pageSize,
});

export const SessionUpdateSchema = z.object({
  id,
  status: StatusSchema,
});

export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;
export type SessionListQuery = z.infer<typeof SessionListQuerySchema>;
export type SessionUpdateInput = z.infer<typeof SessionUpdateSchema>;

export const SessionListQueryRowSchema = z.object({
  id: z.number(),
  tutor_id: z.number(),
  student_id: z.number(),
  subject_id: z.number(),
  parent_id: z.number(),
  slot_units: z.number(),
  scheduled_at: z.string(),
  ends_at: z.string(),
  status: StatusSchema,
  student_parent_id: z.number().nullable(),
  student_learning_goals: z.string().nullable(),
  student_first_name: z.string().nullable(),
  student_last_name: z.string().nullable(),
  student_email: z.string(),
  parent_billing_address: z.string().nullable(),
  parent_notification_preferences: z.string().nullable(),
  parent_first_name: z.string().nullable(),
  parent_last_name: z.string().nullable(),
  parent_email: z.string(),
});

export const SessionListQueryRowListSchema = z.array(SessionListQueryRowSchema);
export type SessionListQueryRow = z.infer<typeof SessionListQueryRowSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const AvailableSessionsQuerySchema = z
  .object({
    subject_id: id,
    from: isoDate,
    to: isoDate,
  })
  .refine(v => v.from < v.to, { message: 'from must be before to', path: ['to'] });

export const AvailableSessionSchema = z.object({
  scheduled_at: z.string().datetime(),
  ends_at: z.string().datetime(),
});

export type AvailableSessionsQuery = z.infer<typeof AvailableSessionsQuerySchema>;
export type AvailableSession = z.infer<typeof AvailableSessionSchema>;
