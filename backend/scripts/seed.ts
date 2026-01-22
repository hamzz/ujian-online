import { createDatabaseClient } from '../src/db';

const client = createDatabaseClient();

const ids = {
  admin: '11111111-1111-1111-1111-111111111111',
  teacher: '22222222-2222-2222-2222-222222222222',
  student: '33333333-3333-3333-3333-333333333333',
  classA: '44444444-4444-4444-4444-444444444444',
  subjectMath: '55555555-5555-5555-5555-555555555555',
  subjectIndo: '66666666-6666-6666-6666-666666666666',
  topicMath: '77777777-7777-7777-7777-777777777777',
  teacherSubjectClass: '88888888-8888-8888-8888-888888888888',
  questionChoice: '99999999-9999-9999-9999-999999999999',
  questionBool: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  examMath: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  sessionOne: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  auditLogin: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  announcement: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  notification: 'ffffffff-ffff-ffff-ffff-ffffffffffff'
};

const seedUsers = [
  {
    id: ids.admin,
    username: 'admin',
    email: null,
    role: 'admin',
    passwordHash: '$2a$10$FCAsTtT76.b4y1ONUQQspeejzZcAKglVL0AvOshF4P9WV1yrBe5Fe',
    profileData: { name: 'Admin' }
  },
  {
    id: ids.teacher,
    username: 'guru',
    email: null,
    role: 'teacher',
    passwordHash: '$2a$10$j2RPaSurZoZgsPjjxVnkCudquo2KyIA7UmQzGPDLEC3B4tRztFEqu',
    profileData: { name: 'Guru Utama' }
  },
  {
    id: ids.student,
    username: 'siswa',
    email: null,
    role: 'student',
    passwordHash: '$2a$10$W/0lRpnFxc97DxJxZmCwC.29yvKM0pKEQkdIuIyzD8WhX6QzM5G/i',
    profileData: { name: 'Siswa Satu', nis: '12345', class: 'X IPA 1' }
  }
];

const ensureRow = async (
  table: string,
  columns: string[],
  values: unknown[],
  whereSql: string,
  whereParams: unknown[]
) => {
  const existing = await client.query<{ found: number }>(
    `SELECT 1 as found FROM ${table} WHERE ${whereSql} LIMIT 1`,
    whereParams
  );
  if (existing.length > 0) return false;
  const placeholders = columns.map(() => '?').join(', ');
  await client.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return true;
};

const ensureById = (table: string, columns: string[], values: unknown[], id: string) =>
  ensureRow(table, columns, values, 'id = ?', [id]);

const ensureUser = async (user: {
  id: string;
  username: string;
  email: string | null;
  role: string;
  passwordHash: string;
  profileData: Record<string, unknown>;
}) => {
  const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE username = ?', [
    user.username
  ]);
  if (existing.length > 0) {
    if (existing[0].id !== user.id) {
      throw new Error(`Seed username already exists with different id: ${user.username}`);
    }
    return;
  }
  await ensureById(
    'users',
    ['id', 'username', 'email', 'password_hash', 'role', 'profile_data'],
    [user.id, user.username, user.email, user.passwordHash, user.role, JSON.stringify(user.profileData)],
    user.id
  );
};

try {
  for (const user of seedUsers) {
    await ensureUser(user);
  }

  await ensureById(
    'classes',
    ['id', 'level', 'major', 'rombel', 'homeroom_teacher_id'],
    [ids.classA, 'X', 'IPA', 'X IPA 1', ids.teacher],
    ids.classA
  );

  await ensureById(
    'subjects',
    ['id', 'name'],
    [ids.subjectMath, 'Matematika'],
    ids.subjectMath
  );
  await ensureById(
    'subjects',
    ['id', 'name'],
    [ids.subjectIndo, 'Bahasa Indonesia'],
    ids.subjectIndo
  );

  await ensureById(
    'teacher_subject_classes',
    ['id', 'teacher_id', 'subject_id', 'class_id'],
    [ids.teacherSubjectClass, ids.teacher, ids.subjectMath, ids.classA],
    ids.teacherSubjectClass
  );

  await ensureById(
    'topics',
    ['id', 'subject_id', 'name'],
    [ids.topicMath, ids.subjectMath, 'Perkalian Dasar'],
    ids.topicMath
  );

  await ensureById(
    'questions',
    [
      'id',
      'subject_id',
      'topic_id',
      'type',
      'content',
      'options',
      'answer_key',
      'explanation',
      'created_by'
    ],
    [
      ids.questionChoice,
      ids.subjectMath,
      ids.topicMath,
      'multiple_choice',
      'Nilai 7 x 8 adalah ...',
      JSON.stringify(['54', '56', '58', '60']),
      JSON.stringify({ correct: '56' }),
      'Perkalian 7 x 8 = 56.',
      ids.teacher
    ],
    ids.questionChoice
  );

  await ensureById(
    'questions',
    [
      'id',
      'subject_id',
      'topic_id',
      'type',
      'content',
      'options',
      'answer_key',
      'explanation',
      'created_by'
    ],
    [
      ids.questionBool,
      ids.subjectMath,
      ids.topicMath,
      'true_false',
      'Bilangan prima terkecil adalah 2.',
      null,
      JSON.stringify({ correct: true }),
      '2 adalah bilangan prima terkecil.',
      ids.teacher
    ],
    ids.questionBool
  );

  await ensureById(
    'exams',
    [
      'id',
      'code',
      'title',
      'instructions',
      'subject_id',
      'start_time',
      'duration_minutes',
      'deadline',
      'settings',
      'created_by'
    ],
    [
      ids.examMath,
      'EXAM001',
      'Ujian Matematika Dasar',
      'Kerjakan dengan teliti.',
      ids.subjectMath,
      '2026-01-21 08:00:00',
      45,
      '2026-01-21 10:00:00',
      JSON.stringify({ shuffleQuestions: false, shuffleOptions: false, attempts: 1 }),
      ids.teacher
    ],
    ids.examMath
  );

  await ensureRow(
    'exam_questions',
    ['exam_id', 'question_id', 'position', 'weight'],
    [ids.examMath, ids.questionChoice, 1, 1],
    'exam_id = ? AND question_id = ?',
    [ids.examMath, ids.questionChoice]
  );

  await ensureRow(
    'exam_questions',
    ['exam_id', 'question_id', 'position', 'weight'],
    [ids.examMath, ids.questionBool, 2, 1],
    'exam_id = ? AND question_id = ?',
    [ids.examMath, ids.questionBool]
  );

  await ensureById(
    'exam_sessions',
    ['id', 'exam_id', 'user_id', 'start_time', 'end_time', 'status', 'logs'],
    [
      ids.sessionOne,
      ids.examMath,
      ids.student,
      '2026-01-21 08:15:00',
      '2026-01-21 08:45:00',
      'submitted',
      JSON.stringify([{ event: 'start', at: '2026-01-21T08:15:00Z' }])
    ],
    ids.sessionOne
  );

  await ensureRow(
    'answers',
    ['session_id', 'question_id', 'response', 'score'],
    [ids.sessionOne, ids.questionChoice, JSON.stringify('56'), 1],
    'session_id = ? AND question_id = ?',
    [ids.sessionOne, ids.questionChoice]
  );

  await ensureRow(
    'answers',
    ['session_id', 'question_id', 'response', 'score'],
    [ids.sessionOne, ids.questionBool, JSON.stringify(true), 1],
    'session_id = ? AND question_id = ?',
    [ids.sessionOne, ids.questionBool]
  );

  await ensureRow(
    'grades',
    ['session_id', 'total_score', 'grade_letter', 'graded_by', 'feedback'],
    [ids.sessionOne, 100, 'A', ids.teacher, 'Bagus.'],
    'session_id = ?',
    [ids.sessionOne]
  );

  await ensureById(
    'school_profile',
    ['id', 'name', 'tagline', 'logo_url', 'banner_url', 'theme_color'],
    [1, 'SMA Contoh', 'Belajar dengan semangat', null, null, 'sekolah'],
    '1'
  );

  await ensureById(
    'app_settings',
    ['id', 'registration_settings'],
    [1, JSON.stringify({ enabled: true, allowed_roles: ['admin'] })],
    '1'
  );

  await ensureById(
    'audit_logs',
    ['id', 'actor_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'detail'],
    [
      ids.auditLogin,
      ids.admin,
      'admin',
      'seed',
      'system',
      null,
      JSON.stringify({ info: 'seed data' })
    ],
    ids.auditLogin
  );

  await ensureById(
    'announcements',
    ['id', 'title', 'message', 'target_role', 'created_by'],
    [ids.announcement, 'Ujian Matematika', 'Ujian matematika dibuka minggu ini.', 'all', ids.admin],
    ids.announcement
  );

  await ensureById(
    'notifications',
    ['id', 'user_id', 'target_role', 'title', 'body', 'channel', 'status'],
    [
      ids.notification,
      ids.student,
      null,
      'Selamat datang',
      'Akun siswa sudah siap digunakan.',
      'in_app',
      'sent'
    ],
    ids.notification
  );

  console.log('Seeder completed');
} finally {
  await client.close();
}
