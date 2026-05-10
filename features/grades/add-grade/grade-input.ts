import { z } from 'zod';

export const GradeInputSchema = z
  .object({
    student_id: z.number().int().positive('Student is required'),
    subject_id: z.number().int().positive('Subject is required'),
    grade: z.number().min(0, 'Grade must be at least 0').max(100, 'Grade must be at most 100'),
  })
  .strict();

export type GradeInput = z.infer<typeof GradeInputSchema>;
