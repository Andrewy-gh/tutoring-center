// Helpers for grabbing types for the DB

import type { Database } from './database.types';
import { Constants } from './database.types';

export type { Database };

export type SessionStatus = Database['public']['Enums']['session_status'];
export type SubjectKind = Database['public']['Enums']['subject_kind'];
export type TransactionType = Database['public']['Enums']['transaction_type'];
export type WeekDay = Database['public']['Enums']['week_day'];

export type SessionRow = Database['public']['Tables']['sessions']['Row'];
export type SessionInsert = Database['public']['Tables']['sessions']['Insert'];
export type SessionUpdate = Database['public']['Tables']['sessions']['Update'];

export type GradeRow = Database['public']['Tables']['student_grades']['Row'];
export type GradeInsert = Database['public']['Tables']['student_grades']['Insert'];

export const SESSION_STATUS_OPTIONS = Constants.public.Enums.session_status;
export const TRANSACTION_TYPE_OPTIONS = Constants.public.Enums.transaction_type;
export const WEEKDAY_OPTIONS = Constants.public.Enums.week_day;

export const DEFAULT_SESSION_STATUS: SessionStatus = 'Scheduled';
export const CANCELED_SESSION_STATUS: SessionStatus = 'Canceled';
export const RESCHEDULED_SESSION_STATUS: SessionStatus = 'Rescheduled';

// Statuses that free up the time slot (do not block future bookings).
export const FREE_SLOT_STATUSES = [CANCELED_SESSION_STATUS, RESCHEDULED_SESSION_STATUS] as const;
export type FreeSlotStatus = (typeof FREE_SLOT_STATUSES)[number];

// Shared select fields so I don't have to repeat it
export const STUDENT_SELECT_WITH_JOINS = `
  id,
  user_id,
  parent_id,
  birth_date,
  grade,
  learning_goals,
  users:user_id (
    first_name,
    last_name,
    email,
    phone
  )
` as const;

export const STUDENT_DETAIL_SESSION_SELECT = `
  id,
  subject_id,
  tutor_id,
  scheduled_at,
  ends_at,
  status,
  slot_units
` as const;

export const STUDENT_DETAIL_SELECT_WITH_JOINS = `
  id,
  user_id,
  parent_id,
  birth_date,
  grade,
  learning_goals,
  users:user_id (
    first_name,
    last_name,
    email,
    phone
  ),
  sessions (
    ${STUDENT_DETAIL_SESSION_SELECT}
  )
` as const;

export const PARENT_DETAIL_STUDENT_SELECT = `
  id,
  user_id,
  grade,
  users:user_id (
    first_name,
    last_name,
    email,
    phone
  )
` as const;

export const PARENT_SELECT_WITH_JOINS = `
  id,
  user_id,
  billing_address,
  notification_preferences,
  users:user_id (
    first_name,
    last_name,
    email,
    phone
  ),
  credit_balances (
    amount_available
  ),
  students (
    id
  )
` as const;

export const PARENT_DETAIL_SELECT_WITH_JOINS = `
  id,
  user_id,
  billing_address,
  notification_preferences,
  users:user_id (
    first_name,
    last_name,
    email,
    phone
  ),
  credit_balances (
    amount_available
  ),
  students (
    ${PARENT_DETAIL_STUDENT_SELECT}
  )
` as const;

export const TUTOR_SELECT_WITH_JOINS = `
  id,
  user_id,
  verified,
  education,
  bio,
  tagline,
  years_experience,
  users:user_id (
    first_name,
    last_name,
    email,
    phone
  )
` as const;
export const SESSION_SELECT_FIELDS =
  'id,tutor_id,student_id,subject_id,parent_id,slot_units,scheduled_at,ends_at,status' as const;

export const GRADE_SELECT_FIELDS = 'id,student_id,subject_id,subject_kind,grade,created_at' as const;

type CreditTransactionSessionJoinMode = 'sessions' | 'sessions!inner';

function buildCreditTransactionSessionSelect(sessionJoinMode: CreditTransactionSessionJoinMode = 'sessions') {
  return `
  session:${sessionJoinMode} (
    id,
    subject_id,
    tutor_id,
    scheduled_at,
    ends_at,
    status
    student_id,
    student:students (
      id,
      user_id,
      grade,
      users:user_id ( first_name, last_name, email, phone )
    )
  )
`;
}

function buildCreditTransactionListSelect(sessionJoinMode: CreditTransactionSessionJoinMode = 'sessions') {
  return `
  id,
  available_delta,
  pending_delta,
  available_after,
  pending_after,
  created_at,
  parent_id,
  session_id,
  type,
  idempotency_key,
  note,
  parent:parents (
    users:user_id ( first_name, last_name )
  ),
  ${buildCreditTransactionSessionSelect(sessionJoinMode)}
` as const;
}

function buildCreditTransactionDetailSelect(sessionJoinMode: CreditTransactionSessionJoinMode = 'sessions') {
  return `
  id,
  available_delta,
  pending_delta,
  available_after,
  pending_after,
  created_at,
  parent_id,
  session_id,
  type,
  idempotency_key,
  note,
  parent:parents (
    id,
    user_id,
    users:user_id ( first_name, last_name, email, phone )
  ),
  ${buildCreditTransactionSessionSelect(sessionJoinMode)}
` as const;
}

export const CREDIT_TRANSACTION_SELECT_WITH_JOINS = buildCreditTransactionListSelect();
export const CREDIT_TRANSACTION_SELECT_WITH_SESSION_INNER = buildCreditTransactionListSelect('sessions!inner');
export const CREDIT_TRANSACTION_LIST_SELECT_WITH_JOINS = buildCreditTransactionListSelect();
export const CREDIT_TRANSACTION_LIST_SELECT_WITH_SESSION_INNER = buildCreditTransactionListSelect('sessions!inner');
export const CREDIT_TRANSACTION_DETAIL_SELECT_WITH_JOINS = buildCreditTransactionDetailSelect();
export const CREDIT_TRANSACTION_DETAIL_SELECT_WITH_SESSION_INNER = buildCreditTransactionDetailSelect('sessions!inner');

// Sessions + joined parent/tutor/student user info
export const SESSION_SELECT_WITH_JOINS = `
  id,
  tutor_id,
  student_id,
  subject_id,
  parent_id,
  slot_units,
  scheduled_at,
  ends_at,
  status,

  student:students (
    id,
    parent_id,
    learning_goals,
    users:user_id (
      first_name,
      last_name,
      email
    )
  ),

  parent:parents (
    id,
    billing_address,
    notification_preferences,
    users:user_id (
      first_name,
      last_name,
      email
    )
  )
` as const;
