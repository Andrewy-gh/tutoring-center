import { z } from 'zod';

const ParentBaseJoinRowSchema = z.object({
  id: z.number(),
  userId: z.number(),
  billingAddress: z.string().nullable(),
  notificationPreferences: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  availableMinutes: z.number().nullable(),
});

export const ParentListJoinRowSchema = ParentBaseJoinRowSchema.extend({
  studentId: z.number().nullable(),
});

export const ParentListJoinRowListSchema = z.array(ParentListJoinRowSchema);
export type ParentListJoinRow = z.infer<typeof ParentListJoinRowSchema>;

const ParentStudentDetailAbsentSchema = z.object({
  studentId: z.null(),
  studentUserId: z.null(),
  studentGrade: z.null(),
  studentFirstName: z.null(),
  studentLastName: z.null(),
  studentEmail: z.null(),
  studentPhone: z.null(),
});

const ParentStudentDetailPresentSchema = z.object({
  studentId: z.number(),
  studentUserId: z.number(),
  studentGrade: z.string().nullable(),
  studentFirstName: z.string().nullable(),
  studentLastName: z.string().nullable(),
  studentEmail: z.string(),
  studentPhone: z.string().nullable(),
});

export const ParentDetailJoinRowSchema = z.intersection(
  ParentBaseJoinRowSchema,
  z.union([ParentStudentDetailAbsentSchema, ParentStudentDetailPresentSchema])
);

export const ParentDetailJoinRowListSchema = z.array(ParentDetailJoinRowSchema);
export type ParentDetailJoinRow = z.infer<typeof ParentDetailJoinRowSchema>;
