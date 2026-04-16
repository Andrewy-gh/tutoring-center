import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5433/tutoring_center';

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
});

function nowIso() {
  return new Date().toISOString();
}

function plusMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function daysFromNow(days, hour) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  value.setUTCHours(hour, 0, 0, 0);
  return value.toISOString();
}

async function ensureRole(name) {
  const [existing] = await sql`select id from roles where name = ${name} limit 1`;
  if (existing) {
    return existing.id;
  }

  const [created] = await sql`insert into roles (name) values (${name}) returning id`;
  if (!created) {
    throw new Error(`Failed to create role: ${name}`);
  }

  return created.id;
}

async function ensureUser({ email, firstName, lastName, phone, roleId }) {
  const [existing] = await sql`select id from users where email = ${email} limit 1`;
  const updatedAt = nowIso();

  if (existing) {
    await sql`
      update users
      set
        first_name = ${firstName},
        last_name = ${lastName},
        phone = ${phone ?? null},
        role = ${roleId ?? null},
        timezone = ${'America/New_York'},
        is_active = ${true},
        updated_at = ${updatedAt}
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [created] = await sql`
    insert into users (
      email,
      first_name,
      last_name,
      phone,
      profile_pic,
      role,
      timezone,
      is_active,
      last_login,
      created_at,
      updated_at
    )
    values (
      ${email},
      ${firstName},
      ${lastName},
      ${phone ?? null},
      ${null},
      ${roleId ?? null},
      ${'America/New_York'},
      ${true},
      ${null},
      ${updatedAt},
      ${updatedAt}
    )
    returning id
  `;

  if (!created) {
    throw new Error(`Failed to create user: ${email}`);
  }

  return created.id;
}

async function ensureParent(userId) {
  const [existing] = await sql`select id from parents where user_id = ${userId} limit 1`;
  const updatedAt = nowIso();

  if (existing) {
    await sql`
      update parents
      set
        billing_address = ${'123 Learning Lane, Durham, NC 27701'},
        notification_preferences = ${'Email and text message reminders'},
        updated_at = ${updatedAt}
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [created] = await sql`
    insert into parents (user_id, billing_address, notification_preferences, created_at, updated_at)
    values (
      ${userId},
      ${'123 Learning Lane, Durham, NC 27701'},
      ${'Email and text message reminders'},
      ${updatedAt},
      ${updatedAt}
    )
    returning id
  `;

  if (!created) {
    throw new Error('Failed to create parent');
  }

  return created.id;
}

async function ensureTutor(userId, { education, bio, tagline, yearsExperience }) {
  const [existing] = await sql`select id from tutors where user_id = ${userId} limit 1`;
  const updatedAt = nowIso();

  if (existing) {
    await sql`
      update tutors
      set
        verified = ${true},
        education = ${education},
        bio = ${bio},
        tagline = ${tagline},
        years_experience = ${yearsExperience},
        updated_at = ${updatedAt}
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [created] = await sql`
    insert into tutors (
      user_id,
      verified,
      education,
      bio,
      tagline,
      years_experience,
      created_at,
      updated_at
    )
    values (
      ${userId},
      ${true},
      ${education},
      ${bio},
      ${tagline},
      ${yearsExperience},
      ${updatedAt},
      ${updatedAt}
    )
    returning id
  `;

  if (!created) {
    throw new Error('Failed to create tutor');
  }

  return created.id;
}

async function ensureStudent(userId, { parentId, birthDate, grade, learningGoals }) {
  const [existing] = await sql`select id from students where user_id = ${userId} limit 1`;
  const updatedAt = nowIso();

  if (existing) {
    await sql`
      update students
      set
        parent_id = ${parentId},
        birth_date = ${birthDate},
        grade = ${grade},
        learning_goals = ${learningGoals},
        updated_at = ${updatedAt}
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [created] = await sql`
    insert into students (
      user_id,
      parent_id,
      birth_date,
      grade,
      learning_goals,
      created_at,
      updated_at
    )
    values (
      ${userId},
      ${parentId},
      ${birthDate},
      ${grade},
      ${learningGoals},
      ${updatedAt},
      ${updatedAt}
    )
    returning id
  `;

  if (!created) {
    throw new Error('Failed to create student');
  }

  return created.id;
}

async function ensureSubjectGroup({ name, slug }) {
  const [existing] = await sql`select id from subjects where slug = ${slug} limit 1`;
  const updatedAt = nowIso();

  if (existing) {
    await sql`
      update subjects
      set
        name = ${name},
        kind = ${'group'},
        parent_subject_id = ${null},
        parent_subject_kind = ${null},
        is_active = ${true},
        updated_at = ${updatedAt}
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [created] = await sql`
    insert into subjects (
      name,
      slug,
      kind,
      parent_subject_id,
      parent_subject_kind,
      is_active,
      created_at,
      updated_at
    )
    values (
      ${name},
      ${slug},
      ${'group'},
      ${null},
      ${null},
      ${true},
      ${updatedAt},
      ${updatedAt}
    )
    returning id
  `;

  if (!created) {
    throw new Error(`Failed to create subject group: ${slug}`);
  }

  return created.id;
}

async function ensureSubject({ name, slug, parentSubjectId }) {
  const [existing] = await sql`select id from subjects where slug = ${slug} limit 1`;
  const updatedAt = nowIso();

  if (existing) {
    await sql`
      update subjects
      set
        name = ${name},
        kind = ${'leaf'},
        parent_subject_id = ${parentSubjectId},
        parent_subject_kind = ${'group'},
        is_active = ${true},
        updated_at = ${updatedAt}
      where id = ${existing.id}
    `;
    return existing.id;
  }

  const [created] = await sql`
    insert into subjects (
      name,
      slug,
      kind,
      parent_subject_id,
      parent_subject_kind,
      is_active,
      created_at,
      updated_at
    )
    values (
      ${name},
      ${slug},
      ${'leaf'},
      ${parentSubjectId},
      ${'group'},
      ${true},
      ${updatedAt},
      ${updatedAt}
    )
    returning id
  `;

  if (!created) {
    throw new Error(`Failed to create subject: ${slug}`);
  }

  return created.id;
}

async function ensureTutorSubject(tutorId, subjectId) {
  const [existing] = await sql`
    select id
    from tutor_subjects
    where tutor_id = ${tutorId} and subject_id = ${subjectId}
    limit 1
  `;

  if (existing) {
    return;
  }

  const updatedAt = nowIso();
  await sql`
    insert into tutor_subjects (tutor_id, subject_id, subject_kind, created_at, updated_at)
    values (${tutorId}, ${subjectId}, ${'leaf'}, ${updatedAt}, ${updatedAt})
  `;
}

async function ensureAvailability(tutorId) {
  const [existing] = await sql`select id from availability where tutor_id = ${tutorId} limit 1`;
  if (existing) {
    return;
  }

  const updatedAt = nowIso();
  await sql`
    insert into availability (tutor_id, week_day, start_time, end_time, created_at, updated_at)
    values
      (${tutorId}, ${'Monday'}, ${'15:00'}, ${'19:00'}, ${updatedAt}, ${updatedAt}),
      (${tutorId}, ${'Wednesday'}, ${'15:00'}, ${'19:00'}, ${updatedAt}, ${updatedAt})
  `;
}

async function ensureCreditBalance(parentId) {
  const [existing] = await sql`select id from credit_balances where parent_id = ${parentId} limit 1`;
  if (existing) {
    return;
  }

  const updatedAt = nowIso();
  await sql`
    insert into credit_balances (parent_id, amount_available, amount_pending, created_at, updated_at)
    values (${parentId}, ${12}, ${0}, ${updatedAt}, ${updatedAt})
  `;
}

async function ensureCreditPurchase(parentId) {
  const [existing] = await sql`
    select id
    from credit_transactions
    where idempotency_key = ${'local-seed-parent-purchase'}
    limit 1
  `;

  if (existing) {
    return;
  }

  await sql`
    insert into credit_transactions (
      parent_id,
      session_id,
      available_delta,
      pending_delta,
      available_after,
      pending_after,
      type,
      idempotency_key,
      note,
      created_at
    )
    values (
      ${parentId},
      ${null},
      ${12},
      ${0},
      ${12},
      ${0},
      ${'purchase'},
      ${'local-seed-parent-purchase'},
      ${'Initial local development credits'},
      ${nowIso()}
    )
  `;
}

async function ensureStudentGrades(studentId, subjectIds) {
  const [existing] = await sql`select id from student_grades where student_id = ${studentId} limit 1`;
  if (existing) {
    return;
  }

  await sql`
    insert into student_grades (student_id, subject_id, subject_kind, grade, created_at)
    values
      (${studentId}, ${subjectIds[0]}, ${'leaf'}, ${'B+'}, ${daysFromNow(-45, 15)}),
      (${studentId}, ${subjectIds[1]}, ${'leaf'}, ${'A-'}, ${daysFromNow(-10, 15)})
  `;
}

async function ensureSessions(parentId, rows) {
  const [existing] = await sql`select id from sessions where parent_id = ${parentId} limit 1`;
  if (existing) {
    return;
  }

  for (const row of rows) {
    const updatedAt = nowIso();
    const endsAt = plusMinutes(row.startsAt, 60);
    const [createdSession] = await sql`
      insert into sessions (
        parent_id,
        student_id,
        tutor_id,
        subject_id,
        slot_units,
        scheduled_at,
        ends_at,
        status,
        created_at,
        updated_at
      )
      values (
        ${parentId},
        ${row.studentId},
        ${row.tutorId},
        ${row.subjectId},
        ${2},
        ${row.startsAt},
        ${endsAt},
        ${row.status},
        ${updatedAt},
        ${updatedAt}
      )
      returning id
    `;

    if (!createdSession || row.status !== 'Completed') {
      continue;
    }

    await sql`
      insert into session_metrics (
        session_id,
        session_performance,
        confidence_score,
        homework_completed,
        tutor_comments,
        recorded_at,
        updated_at
      )
      values (
        ${createdSession.id},
        ${row.score},
        ${row.confidence},
        ${row.homeworkCompleted},
        ${'Solid effort and steady progress this week.'},
        ${endsAt},
        ${updatedAt}
      )
    `;

    await sql`
      insert into session_progress (
        session_id,
        topics,
        public_notes,
        internal_notes,
        homework_assigned,
        created_at,
        updated_at
      )
      values (
        ${createdSession.id},
        ${row.publicNotes ?? 'Reviewed core skills and practiced new examples.'},
        ${row.publicNotes ?? 'Good session with clear improvement.'},
        ${'Local development seed session.'},
        ${'Complete one extra practice set before the next session.'},
        ${endsAt},
        ${updatedAt}
      )
    `;
  }
}

async function main() {
  const adminRoleId = await ensureRole('admin');
  const parentRoleId = await ensureRole('parent');
  const tutorRoleId = await ensureRole('tutor');

  const adminUserId = await ensureUser({
    email: 'local.admin@momentum.test',
    firstName: 'Alex',
    lastName: 'Admin',
    phone: '555-1000',
    roleId: adminRoleId,
  });
  const parentUserId = await ensureUser({
    email: 'local.parent@momentum.test',
    firstName: 'Pat',
    lastName: 'Parent',
    phone: '555-2000',
    roleId: parentRoleId,
  });
  const tutorOneUserId = await ensureUser({
    email: 'local.tutor1@momentum.test',
    firstName: 'Taylor',
    lastName: 'Tutor',
    phone: '555-3001',
    roleId: tutorRoleId,
  });
  const tutorTwoUserId = await ensureUser({
    email: 'local.tutor2@momentum.test',
    firstName: 'Jordan',
    lastName: 'Tutor',
    phone: '555-3002',
    roleId: tutorRoleId,
  });
  const studentOneUserId = await ensureUser({
    email: 'local.student1@momentum.test',
    firstName: 'Sam',
    lastName: 'Student',
    phone: '555-4001',
    roleId: null,
  });
  const studentTwoUserId = await ensureUser({
    email: 'local.student2@momentum.test',
    firstName: 'Riley',
    lastName: 'Student',
    phone: '555-4002',
    roleId: null,
  });

  const parentId = await ensureParent(parentUserId);
  const tutorOneId = await ensureTutor(tutorOneUserId, {
    education: 'B.S. Mathematics',
    bio: 'Helps students build confidence with step-by-step problem solving.',
    tagline: 'Patient math and science support',
    yearsExperience: 6,
  });
  const tutorTwoId = await ensureTutor(tutorTwoUserId, {
    education: 'M.Ed. Reading Instruction',
    bio: 'Focuses on reading fluency, comprehension, and study habits.',
    tagline: 'Clear reading strategies that stick',
    yearsExperience: 8,
  });
  const studentOneId = await ensureStudent(studentOneUserId, {
    parentId,
    birthDate: '2012-09-18',
    grade: '6',
    learningGoals: 'Strengthen algebra foundations and improve quiz confidence.',
  });
  const studentTwoId = await ensureStudent(studentTwoUserId, {
    parentId,
    birthDate: '2010-02-04',
    grade: '8',
    learningGoals: 'Improve reading comprehension and written summaries.',
  });

  const coreSubjectsGroupId = await ensureSubjectGroup({
    name: 'Core Subjects',
    slug: 'core-subjects',
  });

  const subjectIds = [];
  for (const subject of [
    { name: 'Math', slug: 'math' },
    { name: 'Reading', slug: 'reading' },
    { name: 'Science', slug: 'science' },
  ]) {
    subjectIds.push(await ensureSubject({ ...subject, parentSubjectId: coreSubjectsGroupId }));
  }

  for (const subjectId of subjectIds) {
    await ensureTutorSubject(tutorOneId, subjectId);
    await ensureTutorSubject(tutorTwoId, subjectId);
  }

  await ensureAvailability(tutorOneId);
  await ensureAvailability(tutorTwoId);
  await ensureCreditBalance(parentId);
  await ensureCreditPurchase(parentId);
  await ensureStudentGrades(studentOneId, subjectIds);
  await ensureStudentGrades(studentTwoId, [...subjectIds].reverse());
  await ensureSessions(parentId, [
    {
      studentId: studentOneId,
      tutorId: tutorOneId,
      subjectId: subjectIds[0],
      startsAt: daysFromNow(-21, 20),
      status: 'Completed',
      score: 3,
      confidence: 3,
      homeworkCompleted: true,
      publicNotes: 'Practiced multi-step equations and showed better focus.',
    },
    {
      studentId: studentOneId,
      tutorId: tutorOneId,
      subjectId: subjectIds[2],
      startsAt: daysFromNow(-7, 20),
      status: 'Completed',
      score: 4,
      confidence: 4,
      homeworkCompleted: true,
      publicNotes: 'Used diagrams to explain the science concepts clearly.',
    },
    {
      studentId: studentTwoId,
      tutorId: tutorTwoId,
      subjectId: subjectIds[1],
      startsAt: daysFromNow(-14, 21),
      status: 'Completed',
      score: 4,
      confidence: 3,
      homeworkCompleted: false,
      publicNotes: 'Worked on main idea and evidence in short passages.',
    },
    {
      studentId: studentTwoId,
      tutorId: tutorTwoId,
      subjectId: subjectIds[1],
      startsAt: daysFromNow(3, 21),
      status: 'Scheduled',
      score: null,
      confidence: null,
      homeworkCompleted: false,
    },
  ]);

  // eslint-disable-next-line no-console
  console.log(
    [
      'Local seed complete.',
      `Admin user id: ${adminUserId}`,
      `Parent user id: ${parentUserId}`,
      `Tutor user ids: ${tutorOneUserId}, ${tutorTwoUserId}`,
      `Student user ids: ${studentOneUserId}, ${studentTwoUserId}`,
      `Database: ${databaseUrl}`,
    ].join('\n')
  );
}

try {
  await main();
} finally {
  await sql.end({ timeout: 0 });
}
