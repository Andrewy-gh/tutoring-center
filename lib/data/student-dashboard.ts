import 'server-only';
import { studentDashboardDataService } from '@/features/students/student-dashboard-service';

export type {
  StudentCreditHistoryItem,
  StudentDashboardDetails,
  StudentProgressReportItem,
} from '@/features/students/student-dashboard-service';

export async function getStudentDashboardDetails(
  studentId: Parameters<typeof studentDashboardDataService.getStudentDashboardDetails>[0],
  role: Parameters<typeof studentDashboardDataService.getStudentDashboardDetails>[1]
) {
  return studentDashboardDataService.getStudentDashboardDetails(studentId, role);
}
