import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, integer, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { students } from './core';
import { sessions, subjectKindEnum, subjects } from './scheduling';

export const studentGrades = pgTable(
  'student_grades',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id),
    subjectId: integer('subject_id').notNull(),
    subjectKind: subjectKindEnum('subject_kind').notNull().default('leaf'),
    grade: text('grade').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    foreignKey({
      columns: [table.subjectId, table.subjectKind],
      foreignColumns: [subjects.id, subjects.kind],
      name: 'student_grades_subject_id_subject_kind_fkey',
    }),
    check('student_grades_leaf_only', sql`${table.subjectKind} = 'leaf'`),
  ]
);

export const sessionProgress = pgTable(
  'session_progress',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    topics: text('topics'),
    publicNotes: text('public_notes'),
    internalNotes: text('internal_notes'),
    homeworkAssigned: text('homework_assigned'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [unique('session_progress_session_id_unique').on(table.sessionId)]
);

export const sessionMetrics = pgTable(
  'session_metrics',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    sessionPerformance: integer('session_performance'),
    confidenceScore: integer('confidence_score'),
    homeworkCompleted: boolean('homework_completed').notNull().default(false),
    tutorComments: text('tutor_comments'),
    recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [unique('session_metrics_session_id_unique').on(table.sessionId)]
);
