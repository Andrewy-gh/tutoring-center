import 'server-only';
import {
  sessionDataService,
  type SessionDetailType,
  type StudentProgressHistory,
  type TutorAssignedSession,
} from './sessions-service';

export { getCurrentUserID, getUserRole, type UserRole } from '@/lib/auth';
export type { SessionDetailType, SessionRow, StudentProgressHistory, TutorAssignedSession } from './sessions-service';

export async function getSessions(kind: 'all' | 'upcoming' | 'past' = 'all') {
  return sessionDataService.getSessions(kind);
}

export async function getSession(id: number): Promise<SessionDetailType> {
  return sessionDataService.getSession(id);
}

export async function getTutorAssignedSessions(): Promise<TutorAssignedSession[]> {
  return sessionDataService.getTutorAssignedSessions();
}

export async function getStudentRecentProgress(
  studentId: number,
  sessionIdToExclude: number,
  limit: number = 5
): Promise<StudentProgressHistory[]> {
  return sessionDataService.getStudentRecentProgress(studentId, sessionIdToExclude, limit);
}
