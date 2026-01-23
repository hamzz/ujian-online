import type { DatabaseContext } from '../db';
import type { ExamSettings, Role, UserPayload } from '../types';
import { parseCsv, parseJson, toCsv } from '../utils/helpers';

type ImportQuestionsPayload = { csv: string; subject_id?: string };

export const createTeacherService = ({ db }: { db: DatabaseContext }) => {
  const deleteExamCascade = async (examIds: string[]) => {
    if (!examIds.length) return;
    const placeholders = examIds.map(() => '?').join(',');
    await db.query(
      `DELETE FROM answers WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id IN (${placeholders}))`,
      examIds
    );
    await db.query(
      `DELETE FROM grades WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id IN (${placeholders}))`,
      examIds
    );
    await db.query(`DELETE FROM exam_sessions WHERE exam_id IN (${placeholders})`, examIds);
    await db.query(`DELETE FROM exam_questions WHERE exam_id IN (${placeholders})`, examIds);
    await db.query(`DELETE FROM exams WHERE id IN (${placeholders})`, examIds);
  };

  const resolveParticipant = (row: any) => {
    const profile = parseJson<Record<string, unknown>>(row.profile_data, {});
    return {
      name: (profile.display_name as string) ?? row.username ?? '',
      class_name: (profile.class_name as string) ?? ''
    };
  };

  const listSubjects = () => db.query<any>('SELECT * FROM subjects ORDER BY created_at DESC');

  const createSubject = async (name: string) => {
    const id = crypto.randomUUID();
    await db.query('INSERT INTO subjects (id, name) VALUES (?, ?)', [id, name]);
    return { id, name };
  };

  const updateSubject = (id: string, name?: string) =>
    db.query('UPDATE subjects SET name = COALESCE(?, name) WHERE id = ?', [name ?? null, id]);

  const deleteSubject = (id: string) => db.query('DELETE FROM subjects WHERE id = ?', [id]);

  const importQuestions = async (payload: ImportQuestionsPayload, userId: string) => {
    const rows = parseCsv(payload.csv);
    if (!rows.length) return { inserted: 0 };

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
        const existing = await db.query<any>('SELECT id FROM subjects WHERE name = ?', [subjectName]);
        if (existing.length > 0) {
          subjectId = existing[0].id;
        } else if (subjectName) {
          subjectId = crypto.randomUUID();
          await db.query('INSERT INTO subjects (id, name) VALUES (?, ?)', [subjectId, subjectName]);
        }
      }

      if (!subjectId) continue;

      const type = (row[headerMap.type] || 'multiple_choice') as any;
      const content = row[headerMap.content] || '';
      if (!content) continue;

      const optionsRaw = row[headerMap.options] || '';
      const options = optionsRaw ? optionsRaw.split('|').map((item) => item.trim()).filter(Boolean) : null;
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
      await db.query(
        'INSERT INTO questions (id, subject_id, type, content, options, answer_key, explanation, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          id,
          subjectId,
          type,
          content,
          options ? JSON.stringify(options) : null,
          JSON.stringify(answer_key),
          row[headerMap.explanation] || null,
          userId
        ]
      );
      created.push(id);
    }

    return { inserted: created.length };
  };

  const exportQuestions = async (filters: Record<string, string>) => {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (filters.subject_id) {
      clauses.push('q.subject_id = ?');
      values.push(filters.subject_id);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const questions = await db.query<any>(
      `SELECT q.*, s.name as subject_name FROM questions q JOIN subjects s ON s.id = q.subject_id ${where} ORDER BY q.created_at DESC`,
      values
    );
    const rows: string[][] = [['subject', 'type', 'content', 'options', 'answer', 'explanation']];
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
    return toCsv(rows);
  };

  const listQuestions = async (filters: Record<string, string>) => {
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
      db.query<any>(`SELECT COUNT(*) as total FROM questions ${where}`, values),
      db.query<any>(
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
  };

  const createQuestion = async (payload: any, userId: string) => {
    const id = crypto.randomUUID();
    await db.query(
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
        userId
      ]
    );
    return { id };
  };

  const bulkDeleteQuestions = (ids: string[]) =>
    db.query(`DELETE FROM questions WHERE id IN (${ids.map(() => '?').join(',')})`, ids);

  const updateQuestion = (id: string, payload: any) =>
    db.query(
      'UPDATE questions SET content = COALESCE(?, content), options = COALESCE(?, options), image_urls = COALESCE(?, image_urls), answer_key = COALESCE(?, answer_key), explanation = COALESCE(?, explanation), metadata = COALESCE(?, metadata) WHERE id = ?',
      [
        payload.content ?? null,
        payload.options ? JSON.stringify(payload.options) : null,
        payload.image_urls ? JSON.stringify(payload.image_urls) : null,
        payload.answer_key ? JSON.stringify(payload.answer_key) : null,
        payload.explanation ?? null,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
        id
      ]
    );

  const deleteQuestion = (id: string) => db.query('DELETE FROM questions WHERE id = ?', [id]);

  const listExams = async (filters: Record<string, string>) => {
    const page = Math.max(1, Number(filters.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(filters.page_size ?? 10)));
    const offset = (page - 1) * pageSize;

    const [countRows, exams] = await Promise.all([
      db.query<any>('SELECT COUNT(*) as total FROM exams'),
      db.query<any>('SELECT * FROM exams ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, offset])
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
  };

  const createExam = async (payload: any, userId: string) => {
    const id = crypto.randomUUID();
    const code = payload.code || crypto.randomUUID().slice(0, 8).toUpperCase();
    await db.query(
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
        userId
      ]
    );
    if (Array.isArray(payload.questions)) {
      for (const [index, question] of payload.questions.entries()) {
        await db.query(
          'INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)',
          [id, question.question_id, index + 1, question.weight ?? 1]
        );
      }
    }
    return { id, code };
  };

  const getExam = async (id: string) => {
    const exams = await db.query<any>('SELECT * FROM exams WHERE id = ?', [id]);
    const exam = exams[0];
    if (!exam) return null;
    const questions = await db.query<any>(
      'SELECT q.*, eq.position, eq.weight FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.position ASC',
      [id]
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
  };

  const getExamResults = async (id: string) => {
    const rows = await db.query<any>(
      `SELECT s.id as session_id, s.start_time, s.end_time, s.status,
              u.username, u.profile_data, g.total_score, g.grade_letter
       FROM exam_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN grades g ON g.session_id = s.id
       WHERE s.exam_id = ?
       ORDER BY s.start_time DESC`,
      [id]
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
  };

  const getExamResultsCsv = async (id: string) => {
    const rows = await db.query<any>(
      `SELECT s.id as session_id, s.start_time, s.end_time, s.status,
              u.username, u.profile_data, g.total_score, g.grade_letter
       FROM exam_sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN grades g ON g.session_id = s.id
       WHERE s.exam_id = ?
       ORDER BY s.start_time DESC`,
      [id]
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
    return toCsv(csvRows);
  };

  const updateExam = async (id: string, payload: any) => {
    await db.query(
      'UPDATE exams SET title = COALESCE(?, title), instructions = COALESCE(?, instructions), start_time = COALESCE(?, start_time), duration_minutes = COALESCE(?, duration_minutes), deadline = COALESCE(?, deadline), settings = COALESCE(?, settings) WHERE id = ?',
      [
        payload.title ?? null,
        payload.instructions ?? null,
        payload.start_time ?? null,
        payload.duration_minutes ?? null,
        payload.deadline ?? null,
        payload.settings ? JSON.stringify(payload.settings) : null,
        id
      ]
    );
    if (Array.isArray(payload.questions)) {
      await db.query('DELETE FROM exam_questions WHERE exam_id = ?', [id]);
      for (const [index, question] of payload.questions.entries()) {
        await db.query(
          'INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)',
          [id, question.question_id, index + 1, question.weight ?? 1]
        );
      }
    }
    return { success: true };
  };

  const deleteExam = (id: string) => deleteExamCascade([id]);
  const bulkDeleteExams = (ids: string[]) => deleteExamCascade(ids);

  const listEssaySubmissions = async () => {
    const submissions = await db.query<any>(
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
  };

  const gradeEssay = async (sessionId: string, questionId: string, payload: { score: number; comment?: string }) => {
    const answers = await db.query<any>(
      'SELECT response FROM answers WHERE session_id = ? AND question_id = ?',
      [sessionId, questionId]
    );
    const current = answers[0] ? parseJson<any>(answers[0].response, null) : null;
    const nextResponse =
      current && typeof current === 'object'
        ? { ...current, comment: payload.comment ?? current.comment }
        : { value: current, comment: payload.comment ?? '' };
    await db.query(
      'UPDATE answers SET score = ?, response = ? WHERE session_id = ? AND question_id = ?',
      [payload.score, JSON.stringify(nextResponse), sessionId, questionId]
    );
    return { success: true };
  };

  return {
    listSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
    importQuestions,
    exportQuestions,
    listQuestions,
    createQuestion,
    bulkDeleteQuestions,
    updateQuestion,
    deleteQuestion,
    listExams,
    createExam,
    getExam,
    getExamResults,
    getExamResultsCsv,
    updateExam,
    deleteExam,
    bulkDeleteExams,
    listEssaySubmissions,
    gradeEssay
  };
};
