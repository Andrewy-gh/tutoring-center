import { updateSessionStatusById, type UpdatedSessionStatusRow } from '@/db/queries/sessions/update-status';
import { type SessionUpdateInput } from '@/lib/validators/sessions';

export type SessionStatusServiceDeps = {
  updateSessionStatusById: (input: SessionUpdateInput) => Promise<UpdatedSessionStatusRow | null>;
};

export function createSessionStatusService(deps: SessionStatusServiceDeps) {
  return {
    updateSessionStatus(input: SessionUpdateInput) {
      return deps.updateSessionStatusById(input);
    },
  };
}

export const sessionStatusService = createSessionStatusService({
  updateSessionStatusById,
});

export async function updateSessionStatus(input: SessionUpdateInput) {
  return sessionStatusService.updateSessionStatus(input);
}
