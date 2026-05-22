import 'server-only';
import { parentDashboardDataService } from '@/features/parent-dashboard/parent-dashboard-service';

export type {
  ConfidenceDataPoint,
  DateRange,
  GradeDataPoint,
  HomeworkDataPoint,
  PerformanceDataPoint,
  StudentProgressData,
} from '@/features/parent-dashboard/parent-dashboard-service';

export async function getStudentProgressData(
  studentId: Parameters<typeof parentDashboardDataService.getStudentProgressData>[0],
  studentName: Parameters<typeof parentDashboardDataService.getStudentProgressData>[1],
  dateRange?: Parameters<typeof parentDashboardDataService.getStudentProgressData>[2]
) {
  return parentDashboardDataService.getStudentProgressData(studentId, studentName, dateRange);
}

export async function getStudentsWithProgress(
  dateRange?: Parameters<typeof parentDashboardDataService.getStudentsWithProgress>[0],
  subject?: Parameters<typeof parentDashboardDataService.getStudentsWithProgress>[1]
) {
  return parentDashboardDataService.getStudentsWithProgress(dateRange, subject);
}

export async function getParentDashboardData(
  dateRange?: Parameters<typeof parentDashboardDataService.getParentDashboardData>[0],
  subject?: Parameters<typeof parentDashboardDataService.getParentDashboardData>[1]
) {
  return parentDashboardDataService.getParentDashboardData(dateRange, subject);
}

export async function getStudentGrades(studentId: Parameters<typeof parentDashboardDataService.getStudentGrades>[0]) {
  return parentDashboardDataService.getStudentGrades(studentId);
}

export async function getAllSubjects() {
  return parentDashboardDataService.getAllSubjects();
}
