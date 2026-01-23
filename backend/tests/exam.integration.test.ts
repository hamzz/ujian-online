import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { readFile } from 'node:fs/promises';
import { createDatabaseClient, createDatabaseContext, setDefaultClient, closeDatabase } from '../src/db';
import { registerAuthRoutes } from '../src/routes/auth.routes';
import { registerStudentRoutes } from '../src/routes/student.routes';
import { registerTeacherRoutes } from '../src/routes/teacher.routes';
import { registerAdminRoutes } from '../src/routes/admin.routes';
import { registerAnnouncementRoutes } from '../src/routes/announcements.routes';
import { registerNotificationRoutes } from '../src/routes/notifications.routes';
import { registerReportRoutes } from '../src/routes/reports.routes';
import { registerSchoolRoutes } from '../src/routes/school.routes';
import { hashPassword } from '../src/utils/auth';

const API_URL = 'http://localhost';

const envSetup = () => {
  process.env.DATABASE_URL = ':memory:';
  process.env.DATABASE_TYPE = 'sqlite';
  process.env.JWT_SECRET = 'test-secret';
  process.env.CACHE_DRIVER = 'memory';
  process.env.QUEUE_DRIVER = 'memory';
};

const runSqlStatements = async (db: ReturnType<typeof createDatabaseContext>, sql: string) => {
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
};

const buildApp = (dbCtx: ReturnType<typeof createDatabaseContext>) => {
  const app = new Elysia();
  app.use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'test-secret'
    })
  );
  registerSchoolRoutes(app, { db: dbCtx });
  registerAuthRoutes(app, { db: dbCtx });
  registerAdminRoutes(app, { db: dbCtx });
  registerTeacherRoutes(app, { db: dbCtx });
  registerStudentRoutes(app, { db: dbCtx });
  registerAnnouncementRoutes(app, { db: dbCtx });
  registerNotificationRoutes(app, { db: dbCtx });
  registerReportRoutes(app, { db: dbCtx });
  return app;
};

const doRequest = async (app: Elysia, path: string, init: RequestInit = {}) => {
  const url = `${API_URL}${path}`;
  return app.handle(
    new Request(url, {
      headers: { 'content-type': 'application/json', ...(init.headers as any) },
      ...init
    })
  );
};

const readJson = async (response: Response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }
};

describe('Backend integration: auth + exam lifecycle (SQLite in-memory)', () => {
  let app: Elysia;
  let dbCtx: ReturnType<typeof createDatabaseContext>;
  let studentId: string;
  let questionId: string;
  let examId: string;

  beforeAll(async () => {
    envSetup();
    const client = createDatabaseClient();
    setDefaultClient(client);
    dbCtx = createDatabaseContext(client);

    const schemaSql = await readFile(new URL('../../schema.sqlite.sql', import.meta.url), 'utf-8');
    await runSqlStatements(dbCtx, schemaSql);

    // Clean tables in case database URL points to persisted file
    const tables = [
      'answers',
      'grades',
      'exam_sessions',
      'exam_questions',
      'exams',
      'questions',
      'topics',
      'teacher_subject_classes',
      'subjects',
      'classes',
      'audit_logs',
      'app_settings',
      'notifications',
      'announcements',
      'users'
    ];
    for (const table of tables) {
      await dbCtx.execute(`DELETE FROM ${table}`);
    }

    // Seed users
    const adminId = crypto.randomUUID();
    studentId = crypto.randomUUID();
    const teacherId = crypto.randomUUID();
    await dbCtx.execute(
      'INSERT INTO users (id, username, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
      [adminId, 'admin', 'admin@example.com', await hashPassword('adminpass'), 'admin', JSON.stringify({})]
    );
    await dbCtx.execute(
      'INSERT INTO users (id, username, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
      [teacherId, 'teacher', 'teacher@example.com', await hashPassword('teacherpass'), 'teacher', JSON.stringify({})]
    );
    await dbCtx.execute(
      'INSERT INTO users (id, username, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
      [studentId, 'student', 'student@example.com', await hashPassword('studentpass'), 'student', JSON.stringify({})]
    );

    // Allow self-register for all roles
    await dbCtx.execute('INSERT INTO app_settings (id, registration_settings) VALUES (1, ?)', [
      JSON.stringify({ enabled: true, allowed_roles: ['admin', 'teacher', 'student'] })
    ]);

    // Seed subject, question, exam
    const subjectId = crypto.randomUUID();
    await dbCtx.execute('INSERT INTO subjects (id, name) VALUES (?, ?)', [subjectId, 'Matematika']);

    questionId = crypto.randomUUID();
    await dbCtx.execute(
      'INSERT INTO questions (id, subject_id, type, content, options, answer_key, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        questionId,
        subjectId,
        'multiple_choice',
        '2 + 2 = ?',
        JSON.stringify(['1', '2', '3', '4']),
        JSON.stringify({ correct: '4' }),
        teacherId
      ]
    );

    examId = crypto.randomUUID();
    await dbCtx.execute(
      'INSERT INTO exams (id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        examId,
        'EXCODE',
        'Ujian Matematika',
        'Jawab dengan benar',
        subjectId,
        null,
        30,
        null,
        JSON.stringify({ attempts: 1, shuffleQuestions: false, shuffleOptions: false }),
        teacherId
      ]
    );
    await dbCtx.execute(
      'INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)',
      [examId, questionId, 1, 1]
    );

    app = buildApp(dbCtx);
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('auth login should return token', async () => {
    const res = await doRequest(app, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'student', password: 'studentpass' })
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('student');
  });

  it('student can start, answer, submit, and view results of an exam', async () => {
    // login
    const loginRes = await doRequest(app, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'student', password: 'studentpass' })
    });
    const loginBody = await readJson(loginRes);
    const token = loginBody.token as string;

    // start exam
    const startRes = await doRequest(app, `/student/exams/${examId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(startRes.status).toBe(200);
    const { session_id } = await readJson(startRes);
    expect(session_id).toBeDefined();

    // answer question
    const answerRes = await doRequest(app, `/student/sessions/${session_id}/answer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question_id: questionId, response: '4' })
    });
    const answerBody = await readJson(answerRes);
    expect(answerRes.status).toBe(200);
    expect(answerBody.error).toBeUndefined();

    // submit exam
    const submitRes = await doRequest(app, `/student/sessions/${session_id}/submit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(submitRes.status).toBe(200);
    const submitBody = await readJson(submitRes);
    expect(submitBody.total_score).toBeGreaterThanOrEqual(99);

    // fetch results
    const resultsRes = await doRequest(app, `/student/sessions/${session_id}/results`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(resultsRes.status).toBe(200);
    const results = await readJson(resultsRes);
    expect(results.grade.total_score).toBeGreaterThanOrEqual(99);
    expect(results.answers[0].response).toBe('4');
  });
});
