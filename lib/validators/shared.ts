import type { EmbeddedUser } from '@/lib/db/types';
import { z } from 'zod';

export type { EmbeddedUser };

export const id = z.coerce.number().int().positive();
export const page = z.coerce.number().int().min(1).default(1);
export const pageSize = z.coerce.number().int().min(1).max(100).default(10);
export const units1to100 = z.coerce.number().int().min(1).max(100);
export const isoDateTime = z.string().datetime();

export const EmbeddedUserSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
});
