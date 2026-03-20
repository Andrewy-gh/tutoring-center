import { z } from 'zod';
import { StatusSchema } from './sessions';
import { EmbeddedOneUserSchema } from './shared';

export const StudentWithJoinsSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  parent_id: z.number().nullable(),
  birth_date: z.string().nullable(),
  grade: z.string().nullable(),
  learning_goals: z.string().nullable(),
  users: EmbeddedOneUserSchema,
});

export const StudentWithJoinsListSchema = z.array(StudentWithJoinsSchema);

export type StudentWithJoins = z.infer<typeof StudentWithJoinsSchema>;

export const StudentDetailSessionSchema = z.object({
  id: z.number(),
  subject_id: z.number(),
  tutor_id: z.number(),
  scheduled_at: z.string(),
  ends_at: z.string(),
  status: StatusSchema,
  slot_units: z.number(),
});

export const StudentDetailSessionListSchema = z.array(StudentDetailSessionSchema);

export type StudentDetailSession = z.infer<typeof StudentDetailSessionSchema>;

export const StudentDetailWithJoinsSchema = StudentWithJoinsSchema.extend({
  sessions: StudentDetailSessionListSchema.nullable().optional(),
});

export type StudentDetailWithJoins = z.infer<typeof StudentDetailWithJoinsSchema>;
