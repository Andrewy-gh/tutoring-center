import 'server-only';
import { studentDataService } from '@/features/students/students-service';

export type { StudentProfileDetail, StudentRow, StudentSessionRow } from '@/features/students/students-service';

export async function getStudents(role: Parameters<typeof studentDataService.getStudents>[0]) {
  return studentDataService.getStudents(role);
}

export async function getStudent(
  id: Parameters<typeof studentDataService.getStudent>[0],
  role: Parameters<typeof studentDataService.getStudent>[1]
) {
  return studentDataService.getStudent(id, role);
}
