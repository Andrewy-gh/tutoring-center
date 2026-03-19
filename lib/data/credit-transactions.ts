import 'server-only';
import { forbidden, notFound } from 'next/navigation';
import { getCurrentUserID, isValidRole, type UserRole } from '@/lib/auth';
import { getNetCreditDelta } from '@/lib/credit-ledger';
import { getSubjectMapByIds } from '@/lib/data/subjects';
import { getTutorProfileMapByIds } from '@/lib/data/tutors';
import type { Enums, Tables } from '@/lib/supabase/database.types';
import { createSupabaseServiceClient } from '@/lib/supabase/serverClient';
import {
  CREDIT_TRANSACTION_DETAIL_SELECT_WITH_JOINS,
  CREDIT_TRANSACTION_LIST_SELECT_WITH_JOINS,
} from '@/lib/supabase/types';
import { pickFirstEmbedded } from '@/lib/utils/normalize';

type CreditTransactionRecord = Tables<'credit_transactions'>;
type TransactionType = Enums<'transaction_type'>;
type SessionStatus = Enums<'session_status'>;

type Embedded<T> = T | T[] | null;

type UserNameRow = Pick<Tables<'users'>, 'first_name' | 'last_name'>;
type UserContactRow = Pick<Tables<'users'>, 'first_name' | 'last_name' | 'email' | 'phone'>;
type ParentListJoin = {
  users: Embedded<UserNameRow>;
};
type ParentDetailJoin = Pick<Tables<'parents'>, 'id' | 'user_id'> & {
  users: Embedded<UserContactRow>;
};
type StudentJoin = Pick<Tables<'students'>, 'id' | 'user_id' | 'grade'> & {
  users: Embedded<UserContactRow>;
};
type SessionJoin = Pick<Tables<'sessions'>, 'id' | 'scheduled_at' | 'ends_at' | 'status' | 'subject_id' | 'tutor_id'> & {
  student: Embedded<StudentJoin>;
};
type CreditTransactionListWithJoins = CreditTransactionRecord & {
  parent: Embedded<ParentListJoin>;
  session: Embedded<SessionJoin>;
};
type CreditTransactionDetailWithJoins = CreditTransactionRecord & {
  parent: Embedded<ParentDetailJoin>;
  session: Embedded<SessionJoin>;
};

type CreditTransactionStudent = {
  id: number;
  name: string;
  email: string;
  phone: string;
  grade: string;
};

type CreditTransactionSession = {
  id: number;
  scheduled_at: string;
  ends_at: string;
  status: SessionStatus;
  subject_name: string;
  tutor_name: string;
};

export type CreditTransactionRow = {
  id: number;
  created_at: string;
  type: TransactionType;
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
  net_amount: number;
  parent_name: string;
  student_name: string;
  session_id: number | null;
};

export type CreditTransactionDetail = {
  id: number;
  created_at: string;
  type: TransactionType;
  available_delta: number;
  pending_delta: number;
  available_after: number;
  pending_after: number;
  net_amount: number;
  session_id: number | null;
  note: string | null;
  parent: {
    id: number;
    name: string;
    email: string;
    phone: string;
  };
  student: CreditTransactionStudent | null;
  session: CreditTransactionSession | null;
};

const MISSING_VALUE = '\u2014';

function getDisplayName(user: Pick<UserContactRow, 'first_name' | 'last_name'> | null | undefined) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || MISSING_VALUE;
}

function getEmail(user: Pick<UserContactRow, 'email'> | null | undefined) {
  return user?.email ?? MISSING_VALUE;
}

function getPhone(user: Pick<UserContactRow, 'phone'> | null | undefined) {
  return user?.phone ?? MISSING_VALUE;
}

async function getCurrentParentId() {
  const userId = await getCurrentUserID();
  const supabase = createSupabaseServiceClient();
  const { data: parent, error } = await supabase.from('parents').select('id').eq('user_id', userId).single();

  if (error || !parent) {
    notFound();
  }

  return parent.id;
}

function mapSessionStudent(session: Embedded<SessionJoin>): CreditTransactionStudent | null {
  const sessionRecord = pickFirstEmbedded(session);
  const student = pickFirstEmbedded(sessionRecord?.student);
  const studentUser = pickFirstEmbedded(student?.users);

  if (!student) {
    return null;
  }

  return {
    id: student.id,
    name: getDisplayName(studentUser),
    email: getEmail(studentUser),
    phone: getPhone(studentUser),
    grade: student.grade ?? MISSING_VALUE,
  };
}

function mapTransactionRow(transaction: CreditTransactionListWithJoins): CreditTransactionRow {
  const parent = pickFirstEmbedded(transaction.parent);
  const parentUser = pickFirstEmbedded(parent?.users);
  const student = mapSessionStudent(transaction.session);

  return {
    id: transaction.id,
    created_at: transaction.created_at,
    type: transaction.type,
    available_delta: transaction.available_delta,
    pending_delta: transaction.pending_delta,
    available_after: transaction.available_after,
    pending_after: transaction.pending_after,
    net_amount: getNetCreditDelta(transaction),
    parent_name: getDisplayName(parentUser),
    student_name: student?.name ?? MISSING_VALUE,
    session_id: transaction.session_id,
  };
}

function mapTransactionSession(
  transaction: CreditTransactionDetailWithJoins,
  subjectMap: Map<number, { name: string }>,
  tutorMap: Map<number, { name: string }>
): CreditTransactionSession | null {
  const session = pickFirstEmbedded(transaction.session);

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    scheduled_at: session.scheduled_at,
    ends_at: session.ends_at,
    status: session.status,
    subject_name: subjectMap.get(session.subject_id)?.name ?? MISSING_VALUE,
    tutor_name: tutorMap.get(session.tutor_id)?.name ?? MISSING_VALUE,
  };
}

function mapTransactionDetail(
  transaction: CreditTransactionDetailWithJoins,
  subjectMap: Map<number, { name: string }>,
  tutorMap: Map<number, { name: string }>
): CreditTransactionDetail {
  const parent = pickFirstEmbedded(transaction.parent);
  const parentUser = pickFirstEmbedded(parent?.users);

  return {
    id: transaction.id,
    created_at: transaction.created_at,
    type: transaction.type,
    available_delta: transaction.available_delta,
    pending_delta: transaction.pending_delta,
    available_after: transaction.available_after,
    pending_after: transaction.pending_after,
    net_amount: getNetCreditDelta(transaction),
    session_id: transaction.session_id,
    note: transaction.note,
    parent: {
      id: transaction.parent_id,
      name: getDisplayName(parentUser),
      email: getEmail(parentUser),
      phone: getPhone(parentUser),
    },
    student: mapSessionStudent(transaction.session),
    session: mapTransactionSession(transaction, subjectMap, tutorMap),
  };
}

export async function getCreditTransactions(role: UserRole) {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch credit transactions.');
  }

  if (role === 'tutor') {
    forbidden();
  }

  const supabase = createSupabaseServiceClient();
  let transactionsQuery = supabase
    .from('credit_transactions')
    .select(CREDIT_TRANSACTION_LIST_SELECT_WITH_JOINS)
    .order('created_at', { ascending: false });

  if (role === 'parent') {
    const parentId = await getCurrentParentId();
    transactionsQuery = transactionsQuery.eq('parent_id', parentId);
  }

  const { data, error } = await transactionsQuery;

  if (error) {
    throw new Error('Credit transactions are temporarily unavailable. Please try again.');
  }

  return ((data ?? []) as CreditTransactionListWithJoins[]).map(mapTransactionRow);
}

export async function getCreditTransaction(id: number, role: UserRole): Promise<CreditTransactionDetail> {
  if (!isValidRole(role)) {
    throw new Error('Role is required to fetch credit transactions.');
  }

  if (role === 'tutor') {
    forbidden();
  }

  if (Number.isNaN(id)) {
    notFound();
  }

  const supabase = createSupabaseServiceClient();
  let transactionQuery = supabase
    .from('credit_transactions')
    .select(CREDIT_TRANSACTION_DETAIL_SELECT_WITH_JOINS)
    .eq('id', id);

  if (role === 'parent') {
    const parentId = await getCurrentParentId();
    transactionQuery = transactionQuery.eq('parent_id', parentId);
  }

  const { data, error } = await transactionQuery.maybeSingle();

  if (error) {
    throw new Error('Credit transaction details are temporarily unavailable. Please try again.');
  }

  if (!data) {
    notFound();
  }

  const transaction = data as CreditTransactionDetailWithJoins;
  const session = pickFirstEmbedded(transaction.session);
  const subjectMap = await getSubjectMapByIds(session ? [session.subject_id] : []);
  const tutorMap = await getTutorProfileMapByIds(session ? [session.tutor_id] : []);

  return mapTransactionDetail(transaction, subjectMap, tutorMap);
}
