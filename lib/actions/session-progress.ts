'use server';

import { eq } from 'drizzle-orm';
import { getCurrentUserID, getUserRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { sessionProgress, sessions, tutors } from '@/lib/db/schema';

export type ProgressReportFormData = {
  sessionId: number;
  topics: string;
  homeworkAssigned: string;
  publicNotes: string;
  internalNotes: string;
};

async function assertTutorCanSubmitProgressReport(sessionId: number, userId: number) {
  const [session] = await db.select({ tutorId: sessions.tutorId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);

  if (!session) {
    throw new Error('Session not found');
  }

  const [tutor] = await db.select({ id: tutors.id }).from(tutors).where(eq(tutors.userId, userId)).limit(1);

  if (!tutor) {
    throw new Error('Tutor profile not found');
  }

  if (session.tutorId !== tutor.id) {
    throw new Error('You are not assigned to this session');
  }
}

export async function submitProgressReport(formData: ProgressReportFormData) {
  const role = await getUserRole();
  if (role !== 'tutor') {
    throw new Error('Only tutors can submit progress reports');
  }

  const userId = await getCurrentUserID();
  await assertTutorCanSubmitProgressReport(formData.sessionId, userId);

  const now = new Date().toISOString();

  await db
    .insert(sessionProgress)
    .values({
      sessionId: formData.sessionId,
      topics: formData.topics || null,
      homeworkAssigned: formData.homeworkAssigned || null,
      publicNotes: formData.publicNotes || null,
      internalNotes: formData.internalNotes || null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: sessionProgress.sessionId,
      set: {
        topics: formData.topics || null,
        homeworkAssigned: formData.homeworkAssigned || null,
        publicNotes: formData.publicNotes || null,
        internalNotes: formData.internalNotes || null,
        updatedAt: now,
      },
    });

  return { success: true };
}
