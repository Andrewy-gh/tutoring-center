import 'server-only';
import { parentDataService } from '@/features/parents/parents-service';

export type { ParentProfileDetail, ParentRow, ParentStudentRow } from '@/features/parents/parents-service';

export async function getParents(role: Parameters<typeof parentDataService.getParents>[0]) {
  return parentDataService.getParents(role);
}

export async function getParent(
  userId: Parameters<typeof parentDataService.getParent>[0],
  role: Parameters<typeof parentDataService.getParent>[1]
) {
  return parentDataService.getParent(userId, role);
}
