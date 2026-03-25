import { z } from 'zod';
import { EmbeddedUserSchema } from './shared';

const EmbeddedCreditBalanceSchema = z.object({
  amount_available: z.number(),
});

const ParentListStudentSchema = z.object({
  id: z.number(),
});

export const ParentWithJoinsSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  billing_address: z.string().nullable(),
  notification_preferences: z.string().nullable(),
  users: EmbeddedUserSchema,
  credit_balances: EmbeddedCreditBalanceSchema.nullable(),
  students: z.array(ParentListStudentSchema).nullable().optional(),
});

export const ParentWithJoinsListSchema = z.array(ParentWithJoinsSchema);

export type ParentWithJoins = z.infer<typeof ParentWithJoinsSchema>;

export const ParentDetailStudentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  grade: z.string().nullable(),
  users: EmbeddedUserSchema,
});

export type ParentDetailStudent = z.infer<typeof ParentDetailStudentSchema>;

export const ParentDetailWithJoinsSchema = ParentWithJoinsSchema.extend({
  students: z.array(ParentDetailStudentSchema).nullable().optional(),
});

export type ParentDetailWithJoins = z.infer<typeof ParentDetailWithJoinsSchema>;
