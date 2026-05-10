import 'server-only';
import { sessionDataService } from '@/features/sessions/sessions-service';

export { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
export type {
  SessionDetailType,
  SessionRow,
  StudentProgressHistory,
  TutorAssignedSession,
} from '@/features/sessions/sessions-service';

export async function getSessions(kind: 'all' | 'upcoming' | 'past' = 'all') {
  return sessionDataService.getSessions(kind);
}

export async function getSession(id: number) {
  return sessionDataService.getSession(id);
}

export async function getTutorAssignedSessions() {
  return sessionDataService.getTutorAssignedSessions();
}

export async function getStudentRecentProgress(studentId: number, sessionIdToExclude: number, limit: number = 5) {
  return sessionDataService.getStudentRecentProgress(studentId, sessionIdToExclude, limit);
}
