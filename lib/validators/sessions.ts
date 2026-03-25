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

const SessionStudentSchema = z.object({
  id: z.number(),
  parent_id: z.number().nullable(),
  learning_goals: z.string().nullable(),
  users: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string(),
  }),
});

const SessionParentSchema = z.object({
  id: z.number(),
  billing_address: z.string().nullable(),
  notification_preferences: z.string().nullable(),
  users: z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    email: z.string(),
  }),
});

const SessionProgressSchema = z.object({
  id: z.number(),
  session_id: z.number(),
  topics: z.string().nullable(),
  homework_assigned: z.string().nullable(),
  public_notes: z.string().nullable(),
  internal_notes: z.string().nullable(),
});

const SessionMetricsSchema = z.object({
  id: z.number(),
  session_id: z.number(),
  confidence_score: z.number().nullable(),
  session_performance: z.number().nullable(),
  homework_completed: z.boolean().nullable(),
  tutor_comments: z.string().nullable(),
});

export const SessionWithJoinsSchema = z.object({
  id: z.number(),
  tutor_id: z.number(),
  student_id: z.number(),
  subject_id: z.number(),
  parent_id: z.number(),
  slot_units: z.number(),
  scheduled_at: z.string(),
  ends_at: z.string(),
  status: StatusSchema,

  student: SessionStudentSchema,
  parent: SessionParentSchema,
  session_progress: SessionProgressSchema.nullable(),
  session_metrics: SessionMetricsSchema.nullable(),
});

export const SessionWithJoinsListSchema = z.array(SessionWithJoinsSchema);
export type SessionWithJoins = z.infer<typeof SessionWithJoinsSchema>;

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
