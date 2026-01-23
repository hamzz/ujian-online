import { Elysia } from 'elysia';
import { query } from '../db';
import type { ExamSettings, UserPayload } from '../types';
import { authGuard, parseCsv, parseJson, toCsv } from './helpers';

export const registerTeacherRoutes = (app: Elysia) => {
  const deleteExamCascade = async (examIds: string[]) => {
    if (!examIds.length) return;
    const placeholders = examIds.map(() => '?').join(',');
    await query(
      `DELETE FROM answers WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id IN (${placeholders}))`,
      examIds
    );
    await query(
      `DELETE FROM grades WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id IN (${placeholders}))`,
      examIds
    );
    await query(`DELETE FROM exam_sessions WHERE exam_id IN (${placeholders})`, examIds);
    await query(`DELETE FROM exam_questions WHERE exam_id IN (${placeholders})`, examIds);
    await query(`DELETE FROM exams WHERE id IN (${placeholders})`, examIds);
  };

  const resolveParticipant = (row: any) => {
    const profile = parseJson<Record<string, unknown>>(row.profile_data, {});
    return {
      name: (profile.display_name as string) ?? row.username ?? '',
      class_name: (profile.class_name as string) ?? ''
    };
  };

  app.group('/teacher', (teacher) =>
    teacher
      .guard(authGuard(['teacher', 'admin']))
      .get('/subjects', async () => {
        const subjects = await query<any>('SELECT * FROM subjects ORDER BY created_at DESC');
        return subjects;
      })
      .post('/subjects', async ({ body, set }) => {
        const payload = body as { name: string };
        if (!payload.name) {
          set.status = 400;
          return { error: 'Subject name required' };
        }
        const id = crypto.randomUUID();
        await query('INSERT INTO subjects (id, name) VALUES (?, ?)', [id, payload.name]);
        return { id, name: payload.name };
      })
      .put('/subjects/:id', async ({ params, body }) => {
        const payload = body as { name?: string };
        await query('UPDATE subjects SET name = COALESCE(?, name) WHERE id = ?', [
          payload.name ?? null,
          params.id
        ]);
        return { success: true };
      })
      .delete('/subjects/:id', async ({ params }) => {
        await query('DELETE FROM subjects WHERE id = ?', [params.id]);
        return { success: true };
      })
      .post('/import/questions', async ({ body, set, user }) => {
        const payload = body as { csv: string; subject_id?: string };
        if (!payload.csv) {
          set.status = 400;
          return { error: 'CSV required' };
        }

        const rows = parseCsv(payload.csv);
        if (!rows.length) {
          set.status = 400;
          return { error: 'CSV empty' };
        }

        const [header, ...data] = rows;
        const headerMap = header.reduce<Record<string, number>>((acc, key, index) => {
          acc[key.trim().toLowerCase()] = index;
          return acc;
        }, {});

        const created: string[] = [];

        for (const row of data) {
          const subjectName = row[headerMap.subject] || '';
          let subjectId = payload.subject_id || '';
          if (!subjectId) {
            const existing = await query<any>('SELECT id FROM subjects WHERE name = ?', [
              subjectName
            ]);
            if (existing.length > 0) {
              subjectId = existing[0].id;
            } else if (subjectName) {
              subjectId = crypto.randomUUID();
              await query('INSERT INTO subjects (id, name) VALUES (?, ?)', [subjectId, subjectName]);
            }
          }

          if (!subjectId) continue;

          const type = (row[headerMap.type] || 'multiple_choice') as any;
          const content = row[headerMap.content] || '';
          if (!content) continue;

          const optionsRaw = row[headerMap.options] || '';
          const options = optionsRaw
            ? optionsRaw.split('|').map((item) => item.trim()).filter(Boolean)
            : null;
          const answerRaw = row[headerMap.answer] || '';
          let answer_key: any = { correct: answerRaw };
          if (type === 'multiple_select') {
            answer_key = { correct: answerRaw.split('|').map((item) => item.trim()).filter(Boolean) };
          } else if (type === 'true_false') {
            answer_key = { correct: answerRaw.toLowerCase() === 'true' };
          } else if (type === 'short_answer') {
            answer_key = { correct: answerRaw, match: 'exact' };
          } else if (type === 'essay') {
            answer_key = { rubric: answerRaw };
          }

          const id = crypto.randomUUID();
          await query(
            'INSERT INTO questions (id, subject_id, type, content, options, answer_key, explanation, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              subjectId,
              type,
              content,
              options ? JSON.stringify(options) : null,
              JSON.stringify(answer_key),
              row[headerMap.explanation] || null,
              (user as UserPayload).id
            ]
          );
          created.push(id);
        }

        return { inserted: created.length };
      })
      .get('/export/questions', async ({ query: queryParams, set }) => {
        const filters = queryParams as Record<string, string>;
        const clauses: string[] = [];
        const values: unknown[] = [];
        if (filters.subject_id) {
          clauses.push('q.subject_id = ?');
          values.push(filters.subject_id);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const questions = await query<any>(
          `SELECT q.*, s.name as subject_name FROM questions q JOIN subjects s ON s.id = q.subject_id ${where} ORDER BY q.created_at DESC`,
          values
        );
        const rows: string[][] = [
          ['subject', 'type', 'content', 'options', 'answer', 'explanation']
        ];
        for (const question of questions) {
          const answerKey = parseJson<any>(question.answer_key, {});
          let answer = '';
          if (question.type === 'multiple_select') {
            answer = (answerKey.correct ?? []).join('|');
          } else if (question.type === 'true_false') {
            answer = String(answerKey.correct ?? false);
          } else if (question.type === 'essay') {
            answer = answerKey.rubric ?? '';
          } else {
            answer = String(answerKey.correct ?? '');
          }
          rows.push([
            question.subject_name,
            question.type,
            question.content,
            (parseJson<string[]>(question.options, []) || []).join('|'),
            answer,
            question.explanation ?? ''
          ]);
        }
        set.headers['content-type'] = 'text/csv';
        return toCsv(rows);
      })
      .get('/questions', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const clauses: string[] = [];
        const values: unknown[] = [];
        if (filters.subject_id) {
          clauses.push('subject_id = ?');
          values.push(filters.subject_id);
        }
        if (filters.topic_id) {
          clauses.push('topic_id = ?');
          values.push(filters.topic_id);
        }
        if (filters.type) {
          clauses.push('type = ?');
          values.push(filters.type);
        }
        if (filters.search) {
          clauses.push('content LIKE ?');
          values.push(`%${filters.search}%`);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        const offset = (page - 1) * pageSize;

        const [countRows, questions] = await Promise.all([
          query<any>(`SELECT COUNT(*) as total FROM questions ${where}`, values),
          query<any>(
            `SELECT * FROM questions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...values, pageSize, offset]
          )
        ]);

        return {
          total: Number(countRows[0]?.total ?? 0),
          page,
          page_size: pageSize,
          data: questions.map((row) => ({
            ...row,
            options: parseJson(row.options, null),
            image_urls: parseJson(row.image_urls, []),
            answer_key: parseJson(row.answer_key, {}),
            metadata: parseJson(row.metadata, {})
          }))
        };
      })
      .post('/questions', async ({ body, set, user }) => {
        const payload = body as any;
        if (!payload.subject_id || !payload.type || !payload.content || !payload.answer_key) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        const id = crypto.randomUUID();
        await query(
          'INSERT INTO questions (id, subject_id, topic_id, type, content, options, image_urls, answer_key, explanation, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            payload.subject_id,
            payload.topic_id ?? null,
            payload.type,
            payload.content,
            payload.options ? JSON.stringify(payload.options) : null,
            payload.image_urls ? JSON.stringify(payload.image_urls) : null,
            JSON.stringify(payload.answer_key),
            payload.explanation ?? null,
            payload.metadata ? JSON.stringify(payload.metadata) : null,
            (user as UserPayload).id
          ]
        );
        return { id };
      })
      .post('/questions/bulk-delete', async ({ body, set }) => {
        const payload = body as { ids: string[] };
        if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
          set.status = 400;
          return { error: 'ids required' };
        }
        await query(
          `DELETE FROM questions WHERE id IN (${payload.ids.map(() => '?').join(',')})`,
          payload.ids
        );
        return { success: true };
      })
      .put('/questions/:id', async ({ params, body }) => {
        const payload = body as any;
        await query(
          'UPDATE questions SET content = COALESCE(?, content), options = COALESCE(?, options), image_urls = COALESCE(?, image_urls), answer_key = COALESCE(?, answer_key), explanation = COALESCE(?, explanation), metadata = COALESCE(?, metadata) WHERE id = ?',
          [
            payload.content ?? null,
            payload.options ? JSON.stringify(payload.options) : null,
            payload.image_urls ? JSON.stringify(payload.image_urls) : null,
            payload.answer_key ? JSON.stringify(payload.answer_key) : null,
            payload.explanation ?? null,
            payload.metadata ? JSON.stringify(payload.metadata) : null,
            params.id
          ]
        );
        return { success: true };
      })
      .delete('/questions/:id', async ({ params }) => {
        await query('DELETE FROM questions WHERE id = ?', [params.id]);
        return { success: true };
      })
      .get('/exams', async ({ query: queryParams }) => {
        const filters = queryParams as Record<string, string>;
        const page = Math.max(1, Number(filters.page ?? 1));
        const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
        const offset = (page - 1) * pageSize;

        const [countRows, exams] = await Promise.all([
          query<any>('SELECT COUNT(*) as total FROM exams'),
          query<any>(
            'SELECT * FROM exams ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [pageSize, offset]
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
      .post('/exams', async ({ body, set, user }) => {
        const payload = body as any;
        if (!payload.title || !payload.subject_id || !payload.duration_minutes) {
          set.status = 400;
          return { error: 'Missing required fields' };
        }
        const id = crypto.randomUUID();
        const code = payload.code || crypto.randomUUID().slice(0, 8).toUpperCase();
        await query(
          'INSERT INTO exams (id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            code,
            payload.title,
            payload.instructions ?? null,
            payload.subject_id,
            payload.start_time ?? null,
            payload.duration_minutes,
            payload.deadline ?? null,
            JSON.stringify(payload.settings ?? {}),
            (user as UserPayload).id
          ]
        );
        if (Array.isArray(payload.questions)) {
          for (const [index, question] of payload.questions.entries()) {
            await query(
              'INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)',
              [id, question.question_id, index + 1, question.weight ?? 1]
            );
          }
        }
        return { id, code };
      })
      .get('/exams/:id', async ({ params }) => {
        const exams = await query<any>('SELECT * FROM exams WHERE id = ?', [params.id]);
        const exam = exams[0];
        if (!exam) return { error: 'Not found' };
        const questions = await query<any>(
          'SELECT q.*, eq.position, eq.weight FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.position ASC',
          [params.id]
        );
        return {
          ...exam,
          settings: parseJson<ExamSettings>(exam.settings, {}),
          questions: questions.map((row) => ({
            ...row,
            options: parseJson(row.options, null),
            image_urls: parseJson(row.image_urls, []),
            answer_key: parseJson(row.answer_key, {}),
            metadata: parseJson(row.metadata, {})
          }))
        };
      })
      .get('/exams/:id/results', async ({ params }) => {
        const rows = await query<any>(
          `SELECT s.id as session_id, s.start_time, s.end_time, s.status,
                  u.username, u.profile_data, g.total_score, g.grade_letter
           FROM exam_sessions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN grades g ON g.session_id = s.id
           WHERE s.exam_id = ?
           ORDER BY s.start_time DESC`,
          [params.id]
        );
        return rows.map((row) => {
          const participant = resolveParticipant(row);
          return {
            ...row,
            username: participant.name,
            class_name: participant.class_name,
            total_score: row.total_score !== null ? Number(row.total_score) : null
          };
        });
      })
      .get('/exams/:id/results.csv', async ({ params, set }) => {
        const rows = await query<any>(
          `SELECT s.id as session_id, s.start_time, s.end_time, s.status,
                  u.username, u.profile_data, g.total_score, g.grade_letter
           FROM exam_sessions s
           JOIN users u ON u.id = s.user_id
           LEFT JOIN grades g ON g.session_id = s.id
           WHERE s.exam_id = ?
           ORDER BY s.start_time DESC`,
          [params.id]
        );
        const csvRows: string[][] = [
          ['username', 'class_name', 'session_id', 'status', 'start_time', 'end_time', 'total_score', 'grade_letter']
        ];
        for (const row of rows) {
          const participant = resolveParticipant(row);
          csvRows.push([
            participant.name,
            participant.class_name,
            row.session_id ?? '',
            row.status ?? '',
            row.start_time ? new Date(row.start_time).toISOString() : '',
            row.end_time ? new Date(row.end_time).toISOString() : '',
            row.total_score !== null && row.total_score !== undefined ? String(row.total_score) : '',
            row.grade_letter ?? ''
          ]);
        }
        set.headers['content-type'] = 'text/csv';
        return toCsv(csvRows);
      })
      .put('/exams/:id', async ({ params, body }) => {
        const payload = body as any;
        await query(
          'UPDATE exams SET title = COALESCE(?, title), instructions = COALESCE(?, instructions), start_time = COALESCE(?, start_time), duration_minutes = COALESCE(?, duration_minutes), deadline = COALESCE(?, deadline), settings = COALESCE(?, settings) WHERE id = ?',
          [
            payload.title ?? null,
            payload.instructions ?? null,
            payload.start_time ?? null,
            payload.duration_minutes ?? null,
            payload.deadline ?? null,
            payload.settings ? JSON.stringify(payload.settings) : null,
            params.id
          ]
        );
        if (Array.isArray(payload.questions)) {
          await query('DELETE FROM exam_questions WHERE exam_id = ?', [params.id]);
          for (const [index, question] of payload.questions.entries()) {
            await query(
              'INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)',
              [params.id, question.question_id, index + 1, question.weight ?? 1]
            );
          }
        }
        return { success: true };
      })
      .delete('/exams/:id', async ({ params }) => {
        await deleteExamCascade([params.id]);
        return { success: true };
      })
      .post('/exams/bulk-delete', async ({ body, set }) => {
        const payload = body as { ids: string[] };
        if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
          set.status = 400;
          return { error: 'ids required' };
        }
        await deleteExamCascade(payload.ids);
        return { success: true };
      })
      .get('/essay-submissions', async () => {
        const submissions = await query<any>(
          `SELECT a.session_id, a.question_id, a.response, a.score, q.content, e.title as exam_title,
                  s.user_id, u.username, u.profile_data
           FROM answers a
           JOIN questions q ON q.id = a.question_id
           JOIN exam_sessions s ON s.id = a.session_id
           JOIN exams e ON e.id = s.exam_id
           JOIN users u ON u.id = s.user_id
           WHERE q.type = 'essay'
           ORDER BY s.start_time DESC`
        );
        return submissions.map((row) => ({
          ...row,
          username: resolveParticipant(row).name,
          response: parseJson(row.response, null)
        }));
      })
      .put('/essay-submissions/:sessionId/:questionId', async ({ params, body }) => {
        const payload = body as { score: number; comment?: string };
        const answers = await query<any>(
          'SELECT response FROM answers WHERE session_id = ? AND question_id = ?',
          [params.sessionId, params.questionId]
        );
        const current = answers[0] ? parseJson<any>(answers[0].response, null) : null;
        const nextResponse =
          current && typeof current === 'object'
            ? { ...current, comment: payload.comment ?? current.comment }
            : { value: current, comment: payload.comment ?? '' };
        await query(
          'UPDATE answers SET score = ?, response = ? WHERE session_id = ? AND question_id = ?',
          [payload.score, JSON.stringify(nextResponse), params.sessionId, params.questionId]
        );
        return { success: true };
      })
  );

  return app;
};
