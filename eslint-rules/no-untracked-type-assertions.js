import path from 'node:path';

const existingTypeAssertionEntries = [
  "app/dashboard/sessions/page.tsx::params.kind as 'all' | 'upcoming' | 'past' | undefined",
  'components/admin-dashboard/admin-dashboard-content.tsx::`/dashboard?view=${nextView}` as Route<string>',
  'components/admin-dashboard/admin-session-columns.tsx::getValue() as string',
  'components/admin-dashboard/admin-session-columns.tsx::getValue() as string',
  'components/admin-dashboard/admin-session-columns.tsx::getValue() as string',
  'components/admin-dashboard/admin-session-columns.tsx::getValue() as string',
  'components/admin-dashboard/sessions-today-table.tsx::(await response.json().catch(() => null)) as { error?: string } | null',
  'components/admin-dashboard/sessions-today-table.tsx::getValue() as string',
  'components/admin-dashboard/sessions-today-table.tsx::getValue() as string',
  'components/admin-dashboard/sessions-today-table.tsx::getValue() as string',
  'components/admin-dashboard/sessions-today-table.tsx::getValue() as string',
  'components/admin-dashboard/sessions-today-table.tsx::row.original.status as Status',
  'components/admin-dashboard/sessions-today-table.tsx::value as Status',
  'components/data-table.tsx::Object.assign(DataTableRoot, { Toolbar: DataTableToolbar, Search: DataTableSearch, Filter: DataTableFilter, }) as DataTableComponent',
  'components/parent-progress-dashboard.tsx::[] as ConfidenceDataPoint[]',
  'components/parent-progress-dashboard.tsx::[] as GradeDataPoint[]',
  'components/parent-progress-dashboard.tsx::[] as HomeworkDataPoint[]',
  'components/parent-progress-dashboard.tsx::[] as PerformanceDataPoint[]',
  "components/ui/sidebar.tsx::{ '--sidebar-width': SIDEBAR_WIDTH, '--sidebar-width-icon': SIDEBAR_WIDTH_ICON, ...style, } as React.CSSProperties",
  "components/ui/sidebar.tsx::{ '--sidebar-width': SIDEBAR_WIDTH_MOBILE, } as React.CSSProperties",
  "components/ui/sidebar.tsx::{ '--skeleton-width': width, } as React.CSSProperties",
  "components/ui/sonner.tsx::theme as ToasterProps['theme']",
  "components/ui/sonner.tsx::{ '--normal-bg': 'var(--popover)', '--normal-text': 'var(--popover-foreground)', '--normal-border': 'var(--border)', '--border-radius': 'var(--radius)', } as React.CSSProperties",
  'features/booking/booking-screen.tsx::(await response.json().catch(() => null)) as { data?: { id?: number }; error?: string } | null',
  'features/booking/pick-date/index.tsx::(await response.json().catch(() => null)) as { data?: AvailableSession[]; error?: string } | null',
  'features/credits/add-credits/purchase-parent-credits.ts::(await response.json().catch(() => null)) as CreditBalanceResponse | null',
  'features/credits/add-credits/purchase-parent-credits.ts::(await response.json().catch(() => null)) as { error?: string } | null',
  'features/grades/add-grade/grade-service.ts::error.message as (typeof GRADE_ERROR_MESSAGES)[GradeErrorReason]',
  "features/tutor-session/progress-report-form.tsx::formData.get('homeworkAssigned') as string",
  "features/tutor-session/progress-report-form.tsx::formData.get('internalNotes') as string",
  "features/tutor-session/progress-report-form.tsx::formData.get('publicNotes') as string",
  "features/tutor-session/progress-report-form.tsx::formData.get('topics') as string",
  "features/tutor-session/session-metrics-form.tsx::formData.get('tutorComments') as string",
  'lib/admin-dashboard-views.ts::value as ViewKey',
  'lib/admin-dashboard-views.ts::value as ViewKey',
  'lib/data/available-sessions.ts::row.status as FreeSlotStatus',
  'lib/data/dashboard.ts::[] as SessionMetricsRow[]',
  'lib/data/sessions-service.ts::path as Parameters<typeof redirect>[0]',
  'lib/data/tutor-options.ts::[] as TutorOption[]',
  "lib/date-utils.server.ts::dateStr.split('-').map(Number) as [number, number, number]",
  'db/book-session.ts::(await tx.execute(sql` insert into sessions ( tutor_id, student_id, subject_id, parent_id, slot_units, scheduled_at, ends_at, status ) values ( ${input.tutorId}, ${input.studentId}, ${input.subjectId}, ${input.parentId}, ${input.slotUnits}, ${input.scheduledAt}::timestamptz, ${input.endsAt}::timestamptz, ${status} ) returning id, tutor_id, student_id, subject_id, parent_id, slot_units, scheduled_at, ends_at, status `)) as Array<{ id: number; tutor_id: number; student_id: number; subject_id: number; parent_id: number; slot_units: number; scheduled_at: string; ends_at: string; status: SessionStatus; }>',
  'db/book-session.ts::(await tx.execute(sql` select id from credit_balances where parent_id = ${input.parentId} limit 1 `)) as Array<{ id: number }>',
  "db/book-session.ts::(await tx.execute(sql` select id from sessions where tutor_id = ${input.tutorId} and ${overlapStatusPredicate()} and tstzrange(scheduled_at, ends_at, '[)') && tstzrange(${input.scheduledAt}::timestamptz, ${input.endsAt}::timestamptz, '[)') limit 1 `)) as Array<{ id: number }>",
  'db/book-session.ts::(await tx.execute(sql` select id from students where id = ${input.studentId} and parent_id = ${input.parentId} limit 1 `)) as Array<{ id: number }>',
  'db/book-session.ts::(await tx.execute(sql` update credit_balances set available_minutes = available_minutes - ${sessionMinutes}, pending_minutes = pending_minutes + ${sessionMinutes}, updated_at = now() where parent_id = ${input.parentId} and available_minutes >= ${sessionMinutes} returning available_minutes, pending_minutes `)) as Array<{ available_minutes: number; pending_minutes: number }>',
  'db/book-session.ts::db as BookSessionDatabase',
  'db/client.ts::globalThis as typeof globalThis & { __tutoringCenterSql?: ReturnType<typeof postgres>; __tutoringCenterDb?: AppDatabase; }',
  "db/queries/credits/balances.ts::(await import('@/db/client')).db as unknown",
  "db/queries/credits/balances.ts::(await import('@/db/client')).db as unknown as SqlExecutor",
  'tests/components/charts/charts.test.tsx::globalThis as { React?: unknown }',
  'tests/components/charts/charts.test.tsx::globalThis as { React?: unknown }',
  'tests/components/charts/charts.test.tsx::globalThis as { React?: unknown }',
  'tests/components/charts/charts.test.tsx::globalThis as { React?: unknown }',
  'tests/components/charts/charts.test.tsx::globalThis as { React?: unknown }',
  "tests/features/credits/credit-transactions-service.test.ts::'invalid' as UserRole",
  "tests/features/credits/credit-transactions-service.test.ts::'invalid' as UserRole",
  'tests/features/grades/add-grade.test.ts::new Error(NEXT_NOT_FOUND_DIGEST) as Error & { digest?: string }',
  'tests/lib/data/available-sessions.test.ts::MONDAY_AVAILABILITY as never',
  "tests/lib/data/student-dashboard.test.ts::'invalid' as UserRole",
  'tests/lib/data/student-dashboard.test.ts::new Error(NEXT_NOT_FOUND_DIGEST) as Error & { digest?: string }',
  'tests/lib/data/students.test.ts::new Error(NEXT_NOT_FOUND_DIGEST) as Error & { digest?: string }',
  'tests/db/book-session.test.ts::(draft.balance ? [{ id: 1 }] : []) as T',
  'tests/db/book-session.test.ts::(draft.overlap ? [{ id: 7001 }] : []) as T',
  'tests/db/book-session.test.ts::(draft.studentOwned ? [{ id: input.studentId }] : []) as T',
  'tests/db/book-session.test.ts::[] as T',
  'tests/db/book-session.test.ts::[] as T',
  'tests/db/book-session.test.ts::[draft.balance] as T',
  'tests/db/book-session.test.ts::[session] as T',
  'tests/db/credit-balances.test.ts::response as T',
];

const existingTypeAssertionCounts = existingTypeAssertionEntries.reduce((counts, key) => {
  counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}, new Map());

function assertionKey(filename, text) {
  const relativeFilename = path.relative(process.cwd(), filename).split(path.sep).join('/');
  return `${relativeFilename}::${text.replace(/\s+/g, ' ').trim()}`;
}

function isConstAssertion(node, sourceCode) {
  return sourceCode.getText(node).replace(/\s+/g, ' ').trim().endsWith(' as const');
}

/** @type {import('eslint').Rule.RuleModule} */
export const noUntrackedTypeAssertions = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow new TypeScript type assertions unless they are already tracked',
    },
    messages: {
      untracked:
        'Avoid new `as` type assertions. Prefer inference, narrowing, typed helpers, or schema validation. If this is a necessary boundary cast, add it to the assertion baseline intentionally.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const seenAssertions = new Map();

    return {
      TSAsExpression(node) {
        if (isConstAssertion(node, sourceCode)) {
          return;
        }

        const key = assertionKey(context.filename, sourceCode.getText(node));
        const allowedCount = existingTypeAssertionCounts.get(key) ?? 0;
        const seenCount = seenAssertions.get(key) ?? 0;

        if (seenCount < allowedCount) {
          seenAssertions.set(key, seenCount + 1);
          return;
        }

        context.report({
          node,
          messageId: 'untracked',
        });
      },
    };
  },
};
