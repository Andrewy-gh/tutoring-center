import { z } from 'zod';
import { EmbeddedUserSchema } from './shared';

export const TutorWithJoinsSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  verified: z.boolean().default(false),
  education: z.string().nullable(),
  bio: z.string().nullable(),
  tagline: z.string().nullable(),
  years_experience: z.number().nullable(),
  users: EmbeddedUserSchema,
});

export const TutorWithJoinsListSchema = z.array(TutorWithJoinsSchema);

export type TutorWithJoins = z.infer<typeof TutorWithJoinsSchema>;
