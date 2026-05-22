import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { parents, students, tutors } from './core';

export const weekDayEnum = pgEnum('week_day', [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export const sessionStatusEnum = pgEnum('session_status', [
  'Scheduled',
  'Pending-Notes',
  'Completed',
  'Canceled',
  'No-show',
  'Rescheduled',
]);

export const subjectKindEnum = pgEnum('subject_kind', ['group', 'leaf']);

export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    kind: subjectKindEnum('kind').notNull(),
    parentSubjectId: integer('parent_subject_id'),
    parentSubjectKind: subjectKindEnum('parent_subject_kind'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    unique('subjects_slug_unique').on(table.slug),
    unique('subjects_id_kind_unique').on(table.id, table.kind),
    unique('subjects_parent_name_unique').on(table.parentSubjectId, table.name),
    uniqueIndex('subjects_root_name_unique')
      .on(table.name)
      .where(sql`${table.parentSubjectId} is null`),
    foreignKey({
      columns: [table.parentSubjectId, table.parentSubjectKind],
      foreignColumns: [table.id, table.kind],
      name: 'subjects_parent_subject_id_fkey',
    }),
    check(
      'subjects_parent_must_be_group',
      sql`(
        ${table.parentSubjectId} is null
        and ${table.parentSubjectKind} is null
      ) or (
        ${table.parentSubjectId} is not null
        and ${table.parentSubjectKind} = 'group'
      )`
    ),
    check('subjects_not_self_parent', sql`${table.parentSubjectId} is null or ${table.parentSubjectId} <> ${table.id}`),
  ]
);

export const tutorSubjects = pgTable(
  'tutor_subjects',
  {
    id: serial('id').primaryKey(),
    tutorId: integer('tutor_id')
      .notNull()
      .references(() => tutors.id),
    subjectId: integer('subject_id').notNull(),
    subjectKind: subjectKindEnum('subject_kind').notNull().default('leaf'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    unique('tutor_subjects_tutor_id_subject_id_unique').on(table.tutorId, table.subjectId),
    foreignKey({
      columns: [table.subjectId, table.subjectKind],
      foreignColumns: [subjects.id, subjects.kind],
      name: 'tutor_subjects_subject_id_subject_kind_fkey',
    }),
    check('tutor_subjects_leaf_only', sql`${table.subjectKind} = 'leaf'`),
  ]
);

export const availability = pgTable('availability', {
  id: serial('id').primaryKey(),
  tutorId: integer('tutor_id')
    .notNull()
    .references(() => tutors.id),
  weekDay: weekDayEnum('week_day').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id')
      .notNull()
      .references(() => parents.id),
    studentId: integer('student_id').notNull(),
    tutorId: integer('tutor_id')
      .notNull()
      .references(() => tutors.id),
    subjectId: integer('subject_id').notNull(),
    slotUnits: integer('slot_units').notNull().default(2),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'string' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'string' }).notNull(),
    status: sessionStatusEnum('status').notNull().default('Scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  table => [
    index('sessions_status_scheduled_at_idx').on(table.status, table.scheduledAt),
    foreignKey({
      columns: [table.studentId, table.parentId],
      foreignColumns: [students.id, students.parentId],
      name: 'sessions_student_id_parent_id_fkey',
    }),
    foreignKey({
      columns: [table.tutorId, table.subjectId],
      foreignColumns: [tutorSubjects.tutorId, tutorSubjects.subjectId],
      name: 'sessions_tutor_id_subject_id_fkey',
    }),
    check('sessions_slot_units_positive', sql`${table.slotUnits} > 0`),
    check('sessions_ends_after_start', sql`${table.endsAt} > ${table.scheduledAt}`),
    check(
      'sessions_slot_units_match_range',
      sql`${table.endsAt} = ${table.scheduledAt} + (${table.slotUnits} * interval '30 minutes')`
    ),
  ]
);
