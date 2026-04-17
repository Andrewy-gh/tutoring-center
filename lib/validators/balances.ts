import { z } from 'zod';
import { id } from './shared';

export const BalanceQuerySchema = z.object({
  parent_id: id,
});

export const BalanceUpdateSchema = z.object({
  parent_id: id,
  available_minutes: z.number().int().nonnegative(),
  pending_minutes: z.number().int().nonnegative(),
});

export type BalanceQueryInput = z.infer<typeof BalanceQuerySchema>;
export type BalanceUpdateInput = z.infer<typeof BalanceUpdateSchema>;
