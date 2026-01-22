import { Elysia } from 'elysia';
import { databaseType, query } from '../db';
import type { ExamSettings, UserPayload } from '../types';
import { computeGradeLetter, gradeAnswer } from '../utils/grading';
import { getCacheClient } from '../utils/cache';
import { authGuard, now, parseJson } from './helpers';
import { answerQueue, queueSettings, submitQueue } from './queue';

const answersUpsertSql =
  databaseType === 'sqlite'
    ? 'INSERT INTO answers (session_id, question_id, response) VALUES (?, ?, ?) ON CONFLICT(session_id, question_id) DO UPDATE SET response = excluded.response'
    : 'INSERT INTO answers (session_id, question_id, response) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response = VALUES(response)';

const gradesUpsertSql =
  databaseType === 'sqlite'
    ? 'INSERT INTO grades (session_id, total_score, grade_letter) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET total_score = excluded.total_score, grade_letter = excluded.grade_letter'
    : 'INSERT INTO grades (session_id, total_score, grade_letter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), grade_letter = VALUES(grade_letter)';

export const registerStudentRoutes = (app: Elysia) => {
  const cache = getCacheClient();
  const cacheTtlSeconds = 10 * 60;

  const toLocalSqliteTimestamp = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const getCachedQuestions = async (examId: string) => {
    const cached = await cache.get<any[]>(`exam-questions:${examId}`);
    if (cached) return cached;

    const questions = await query<any>(
      'SELECT q.*, eq.position, eq.weight FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.position ASC',
      [examId]
    );
    const parsed = questions.map((row) => ({
      ...row,
      options: parseJson(row.options, null),
      image_urls: parseJson(row.image_urls, []),
      answer_key: parseJson(row.answer_key, {}),
      metadata: parseJson(row.metadata, {})
    }));
    await cache.set(`exam-questions:${examId}`, parsed, cacheTtlSeconds);
    return parsed;
  };

  app.group('/student', (student) =>
    student
      .guard(authGuard(['student', 'admin']))
      .get('/exams', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        const offset = (page - 1) * pageSize;
        const current = now();
        const timeParam = databaseType === 'sqlite' ? toLocalSqliteTimestamp(current) : current;
        const examsSql =
          databaseType === 'sqlite'
            ? 'FROM exams WHERE (start_time IS NULL OR datetime(start_time) <= datetime(?)) AND (deadline IS NULL OR datetime(deadline) >= datetime(?))'
            : 'FROM exams WHERE (start_time IS NULL OR start_time <= ?) AND (deadline IS NULL OR deadline >= ?)';
        const [countRows, exams] = await Promise.all([
          query<any>(`SELECT COUNT(*) as total ${examsSql}`, [timeParam, timeParam]),
          query<any>(
            `SELECT * ${examsSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [timeParam, timeParam, pageSize, offset]
          )
        ]);
        return {
          total: Number(countRows[0]?.total ?? 0),
          page,
          page_size: pageSize,
          data: exams.map((row) => ({
            ...row,
            settings: parseJson<ExamSettings>(row.settings, {})
          }))
        };
      })
      .post('/exams/:id/start', async ({ params, user, set }) => {
        const exams = await query<any>('SELECT * FROM exams WHERE id = ?', [params.id]);
        const exam = exams[0];
        if (!exam) {
          set.status = 404;
          return { error: 'Exam not found' };
        }

        const nowTimestamp = databaseType === 'sqlite' ? toLocalSqliteTimestamp(now()) : now();
        const currentTime = now().getTime();
        const startTime = exam.start_time ? new Date(exam.start_time).getTime() : null;
        const deadline = exam.deadline ? new Date(exam.deadline).getTime() : null;
        if (startTime && currentTime < startTime) {
          set.status = 403;
          return { error: 'Exam not started yet' };
        }
        if (deadline && currentTime > deadline) {
          set.status = 403;
          return { error: 'Exam deadline passed' };
        }

        const settings = parseJson<ExamSettings>(exam.settings, {});
        const attemptsAllowed = settings.attempts ?? 1;
        const existingSessions = await query<any>(
          'SELECT * FROM exam_sessions WHERE exam_id = ? AND user_id = ? ORDER BY start_time DESC',
          [params.id, (user as UserPayload).id]
        );
        const inProgress = existingSessions.find((session) => session.status === 'in_progress');
        if (inProgress) {
          return { session_id: inProgress.id };
        }
        if (attemptsAllowed && existingSessions.length >= attemptsAllowed) {
          set.status = 403;
          return { error: 'Attempt limit reached' };
        }

        await getCachedQuestions(exam.id).catch(() => null);
        const sessionId = crypto.randomUUID();
        await query(
          'INSERT INTO exam_sessions (id, exam_id, user_id, start_time, status, logs) VALUES (?, ?, ?, ?, ?, ?)',
          [
            sessionId,
            params.id,
            (user as UserPayload).id,
            nowTimestamp,
            'in_progress',
            JSON.stringify([])
          ]
        );
        return { session_id: sessionId };
      })
      .get('/sessions/:id', async ({ params, set }) => {
        const sessions = await query<any>('SELECT * FROM exam_sessions WHERE id = ?', [params.id]);
        const session = sessions[0];
        if (!session) {
          set.status = 404;
          return { error: 'Session not found' };
        }
        const exams = await query<any>('SELECT * FROM exams WHERE id = ?', [session.exam_id]);
        const exam = exams[0];
        if (!exam) {
          set.status = 404;
          return { error: 'Exam not found' };
        }
        const settings = parseJson<ExamSettings>(exam.settings, {});
        const cachedQuestions = await getCachedQuestions(session.exam_id);
        let ordered = cachedQuestions.map((question) => ({ ...question }));
        if (settings.shuffleQuestions) {
          ordered = [...ordered].sort(() => Math.random() - 0.5);
        }
        if (settings.shuffleOptions) {
          ordered = ordered.map((question) => {
            if (!Array.isArray(question.options)) return question;
            return { ...question, options: [...question.options].sort(() => Math.random() - 0.5) };
          });
        }
        return {
          session: {
            id: session.id,
            exam_id: session.exam_id,
            start_time: session.start_time,
            status: session.status
          },
          exam: {
            id: exam.id,
            title: exam.title,
            instructions: exam.instructions,
            duration_minutes: exam.duration_minutes,
            settings
          },
          questions: ordered
        };
      })
      .post('/sessions/:id/answer', async ({ params, body, set }) => {
        const payload = body as { question_id: string; response: unknown };
        if (!payload.question_id) {
          set.status = 400;
          return { error: 'question_id required' };
        }
        try {
          await answerQueue.enqueue(async () => {
            await query(answersUpsertSql, [
              params.id,
              payload.question_id,
              JSON.stringify(payload.response)
            ]);
          }, queueSettings.maxQueue);
          return { success: true };
        } catch (err: any) {
          set.status = 429;
          return { error: 'Queue is full' };
        }
      })
      .post('/sessions/:id/logs', async ({ params, body }) => {
        const payload = body as { event: string; detail?: Record<string, unknown> };
        const sessions = await query<any>('SELECT logs FROM exam_sessions WHERE id = ?', [params.id]);
        const current = sessions[0]?.logs ? parseJson<any[]>(sessions[0].logs, []) : [];
        const updated = [
          ...current,
          { event: payload.event, detail: payload.detail ?? {}, at: now().toISOString() }
        ];
        await query('UPDATE exam_sessions SET logs = ? WHERE id = ?', [JSON.stringify(updated), params.id]);
        return { success: true };
      })
      .post('/sessions/:id/heartbeat', async ({ params, body }) => {
        const payload = body as { status?: string; detail?: Record<string, unknown> };
        const sessions = await query<any>('SELECT logs FROM exam_sessions WHERE id = ?', [params.id]);
        const current = sessions[0]?.logs ? parseJson<any[]>(sessions[0].logs, []) : [];
        const updated = [
          ...current,
          { event: 'heartbeat', detail: payload.detail ?? {}, status: payload.status ?? 'ok', at: now().toISOString() }
        ];
        await query('UPDATE exam_sessions SET logs = ? WHERE id = ?', [JSON.stringify(updated), params.id]);
        return { success: true };
      })
      .post('/sessions/:id/submit', async ({ params, set }) => {
        const sessions = await query<any>('SELECT * FROM exam_sessions WHERE id = ?', [params.id]);
        const session = sessions[0];
        if (!session) {
          set.status = 404;
          return { error: 'Session not found' };
        }
        try {
          const result = await submitQueue.enqueue(async () => {
            const questions = await query<any>(
              'SELECT q.*, eq.weight FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ?',
              [session.exam_id]
            );
            const answers = await query<any>('SELECT * FROM answers WHERE session_id = ?', [params.id]);

            let totalWeight = 0;
            let totalScore = 0;

            for (const question of questions) {
              const weight = Number(question.weight ?? 1);
              totalWeight += weight;
              const answer = answers.find((entry) => entry.question_id === question.id);
              const response = answer ? parseJson(answer.response, null) : null;
              const score = gradeAnswer(
                {
                  type: question.type,
                  answer_key: parseJson(question.answer_key, {})
                },
                { response }
              );
              const weightedScore = score * weight;
              totalScore += weightedScore;
              await query(
                'UPDATE answers SET score = ? WHERE session_id = ? AND question_id = ?',
                [weightedScore, params.id, question.id]
              );
            }

            const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
            const gradeLetter = computeGradeLetter(normalizedScore);

            await query(gradesUpsertSql, [params.id, normalizedScore, gradeLetter]);
            const endTimestamp = databaseType === 'sqlite' ? toLocalSqliteTimestamp(now()) : now();
            await query('UPDATE exam_sessions SET status = ?, end_time = ? WHERE id = ?', [
              'submitted',
              endTimestamp,
              params.id
            ]);
            return { total_score: normalizedScore, grade_letter: gradeLetter };
          }, queueSettings.maxQueue);
          return result;
        } catch (err: any) {
          set.status = 429;
          return { error: 'Queue is full' };
        }
      })
      .get('/sessions/:id/results', async ({ params, set }) => {
        const grades = await query<any>('SELECT * FROM grades WHERE session_id = ?', [params.id]);
        if (!grades.length) {
          set.status = 404;
          return { error: 'Grade not found' };
        }
        const answers = await query<any>('SELECT * FROM answers WHERE session_id = ?', [params.id]);
        return {
          grade: grades[0],
          answers: answers.map((row) => ({
            ...row,
            response: parseJson(row.response, null)
          }))
        };
      })
  );

  return app;
};
