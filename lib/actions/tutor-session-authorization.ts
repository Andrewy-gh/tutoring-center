export type TutorSessionAuthorizationDeps = {
  getSessionTutorId: (sessionId: number) => Promise<number | null>;
  getTutorIdByUserId: (userId: number) => Promise<number | null>;
};

export async function assertTutorOwnsSession(sessionId: number, userId: number, deps: TutorSessionAuthorizationDeps) {
  const sessionTutorId = await deps.getSessionTutorId(sessionId);
  if (!sessionTutorId) {
    throw new Error('Session not found');
  }

  const tutorId = await deps.getTutorIdByUserId(userId);
  if (!tutorId) {
    throw new Error('Tutor profile not found');
  }

  if (sessionTutorId !== tutorId) {
    throw new Error('You are not assigned to this session');
  }
}
