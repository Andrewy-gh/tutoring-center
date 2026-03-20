import { z } from 'zod';

export const SubjectKindSchema = z.enum(['group', 'leaf']);

export const SubjectRecordSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  kind: SubjectKindSchema,
  is_active: z.boolean(),
});

export const SubjectRecordListSchema = z.array(SubjectRecordSchema);

export const ActiveLeafSubjectSchema = SubjectRecordSchema.extend({
  kind: z.literal('leaf'),
  is_active: z.literal(true),
});

export const ActiveLeafSubjectListSchema = z.array(ActiveLeafSubjectSchema);

export const TutorSubjectAssignmentSchema = z.object({
  tutor_id: z.number(),
  subject_id: z.number(),
});

export const SubjectOptionRowSchema = ActiveLeafSubjectSchema.extend({
  tutor_subjects: z.array(TutorSubjectAssignmentSchema).nullable().optional(),
});

export const SubjectOptionRowListSchema = z.array(SubjectOptionRowSchema);

export type SubjectRecord = z.infer<typeof SubjectRecordSchema>;
export type ActiveLeafSubject = z.infer<typeof ActiveLeafSubjectSchema>;
export type SubjectOptionRow = z.infer<typeof SubjectOptionRowSchema>;
