import { z } from 'zod';

export const TutorJoinRowSchema = z.object({
  id: z.number(),
  userId: z.number(),
  verified: z.boolean(),
  education: z.string().nullable(),
  bio: z.string().nullable(),
  tagline: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
});

export const TutorJoinRowListSchema = z.array(TutorJoinRowSchema);
export type TutorJoinRow = z.infer<typeof TutorJoinRowSchema>;
