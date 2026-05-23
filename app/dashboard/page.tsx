import { DataTable } from '@/components/data-table';
import { AdminDashboardContent } from '@/features/admin-dashboard/admin-dashboard-content';
import { parseViewKey } from '@/features/admin-dashboard/admin-dashboard-views';
import {
  getParentDashboardData,
  getStudentGrades,
  type GradeDataPoint,
} from '@/features/parent-dashboard/parent-dashboard-service';
import { ParentProgressDashboard } from '@/features/parent-dashboard/parent-progress-dashboard';
import { getTutorAssignedSessions } from '@/features/sessions/sessions-service';
import type { TutorAssignedSession } from '@/features/sessions/sessions-service';
import { tutorSessionColumns } from '@/features/tutor-session/pending-session-columns';
import { getCurrentUserName, getUserRole } from '@/lib/auth';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const role = await getUserRole();
  const userName = await getCurrentUserName();
  const params = await searchParams;
  const view = parseViewKey(params.view);

  return (
    <main className='p-2 md:p-8'>
      <div className='flex items-center gap-2 mb-1'>
        <h1 className='font-serif text-3xl text-primary'>Dashboard</h1>
      </div>
      {userName && <p className='text-lg mb-6'>Welcome, {userName}!</p>}

      {role === 'admin' && <AdminDashboardContent view={view} />}
      {role === 'tutor' && <TutorDashboardContent />}
      {role === 'parent' && <ParentDashboardContent />}
    </main>
  );
}

async function TutorDashboardContent() {
  const sessions: TutorAssignedSession[] = await getTutorAssignedSessions();

  return (
    <section>
      <h2 className='text-2xl font-semibold mb-4'>Pending Sessions</h2>

      {sessions.length === 0 ? (
        <p className='text-muted-foreground'>No sessions currently need progress reports.</p>
      ) : (
        <DataTable columns={tutorSessionColumns} data={sessions} />
      )}
    </section>
  );
}

async function ParentDashboardContent() {
  const { students, defaultStudentId } = await getParentDashboardData();

  let grades: GradeDataPoint[] = [];
  if (defaultStudentId) {
    grades = await getStudentGrades(defaultStudentId);
  }

  return (
    <section>
      <h2 className='font-serif text-2xl text-primary mb-4'>Progress Overview</h2>
      <ParentProgressDashboard students={students} defaultStudentId={defaultStudentId} grades={grades} />
    </section>
  );
}
