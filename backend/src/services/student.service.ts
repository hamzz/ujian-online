import { DatabaseContext, databaseType } from '../db';
import type { ExamSettings, UserPayload } from '../types';
import { computeGradeLetter, gradeAnswer } from '../utils/grading';
import { getCacheClient } from '../utils/cache';
import { hashPassword } from '../utils/auth';
import { now, parseJson } from '../utils/helpers';
import { answerQueue, queueSettings, submitQueue } from '../utils/queue';

export type StudentServiceDeps = {
  db: DatabaseContext;
};

export const createStudentService = ({ db }: StudentServiceDeps) => {
  const cache = getCacheClient();
  const cacheTtlSeconds = 10 * 60;

  const answersUpsertSql =
    databaseType === 'sqlite'
      ? 'INSERT INTO answers (session_id, question_id, response) VALUES (?, ?, ?) ON CONFLICT(session_id, question_id) DO UPDATE SET response = excluded.response'
      : 'INSERT INTO answers (session_id, question_id, response) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response = VALUES(response)';

  const gradesUpsertSql =
    databaseType === 'sqlite'
      ? 'INSERT INTO grades (session_id, total_score, grade_letter) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET total_score = excluded.total_score, grade_letter = excluded.grade_letter'
      : 'INSERT INTO grades (session_id, total_score, grade_letter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), grade_letter = VALUES(grade_letter)';

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

    const questions = await db.query<any>(
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

  const normalizeGuestKey = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const buildSimpleUsername = (name: string, className: string) => {
    const nameKey = normalizeGuestKey(name);
    const classKey = normalizeGuestKey(className);
    const base = [nameKey, classKey].filter(Boolean).join('-') || 'student';
    return `guest_${base}`;
  };

  const getOrCreateSimpleUser = async (name: string, className: string) => {
    const username = buildSimpleUsername(name, className);
    const existing = await db.query<any>('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      const current = existing[0];
      const profile = parseJson<Record<string, unknown>>(current.profile_data, {});
      const nextProfile = {
        ...profile,
        display_name: name,
        class_name: className,
        access_mode: 'simple'
      };
      if (JSON.stringify(profile) !== JSON.stringify(nextProfile)) {
        await db.query('UPDATE users SET profile_data = ? WHERE id = ?', [
          JSON.stringify(nextProfile),
          current.id
        ]);
      }
      return current;
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(crypto.randomUUID());
    const profile = {
      display_name: name,
      class_name: className,
      access_mode: 'simple'
    };
    await db.query(
      'INSERT INTO users (id, username, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, null, passwordHash, 'student', JSON.stringify(profile)]
    );
    return { id, username, role: 'student', profile_data: JSON.stringify(profile) };
  };

  const loadSimpleSession = async (sessionId: string) => {
    const sessions = await db.query<any>(
      'SELECT s.*, u.profile_data FROM exam_sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
      [sessionId]
    );
    const session = sessions[0];
    if (!session) {
      return { status: 404, error: 'Session not found' } as const;
    }

    const exams = await db.query<any>('SELECT * FROM exams WHERE id = ?', [session.exam_id]);
    const exam = exams[0];
    if (!exam) {
      return { status: 404, error: 'Exam not found' } as const;
    }

    const settings = parseJson<ExamSettings>(exam.settings, {});
    if (!settings.simpleAccess?.enabled) {
      return { status: 403, error: 'Simple access is disabled' } as const;
    }

    const profile = parseJson<Record<string, unknown>>(session.profile_data, {});
    if (profile.access_mode !== 'simple') {
      return { status: 403, error: 'Access denied' } as const;
    }

    return { session, exam, settings } as const;
  };

  const listExams = async (filters: Record<string, string>) => {
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
      db.query<any>(`SELECT COUNT(*) as total ${examsSql}`, [timeParam, timeParam]),
      db.query<any>(
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
  };

  const startExam = async (examId: string, user: UserPayload) => {
    const exams = await db.query<any>('SELECT * FROM exams WHERE id = ?', [examId]);
    const exam = exams[0];
    if (!exam) {
      return { status: 404, error: 'Exam not found' } as const;
    }

    const nowTimestamp = databaseType === 'sqlite' ? toLocalSqliteTimestamp(now()) : now();
    const currentTime = now().getTime();
    const startTime = exam.start_time ? new Date(exam.start_time).getTime() : null;
    const deadline = exam.deadline ? new Date(exam.deadline).getTime() : null;
    if (startTime && currentTime < startTime) {
      return { status: 403, error: 'Exam not started yet' } as const;
    }
    if (deadline && currentTime > deadline) {
      return { status: 403, error: 'Exam deadline passed' } as const;
    }

    const settings = parseJson<ExamSettings>(exam.settings, {});
    const attemptsAllowed = settings.attempts ?? 1;
    const existingSessions = await db.query<any>(
      'SELECT * FROM exam_sessions WHERE exam_id = ? AND user_id = ? ORDER BY start_time DESC',
      [examId, user.id]
    );
    const inProgress = existingSessions.find((session) => session.status === 'in_progress');
    if (inProgress) {
      return { session_id: inProgress.id };
    }
    if (attemptsAllowed && existingSessions.length >= attemptsAllowed) {
      return { status: 403, error: 'Attempt limit reached' } as const;
    }

    await getCachedQuestions(exam.id).catch(() => null);
    const sessionId = crypto.randomUUID();
    await db.query(
      'INSERT INTO exam_sessions (id, exam_id, user_id, start_time, status, logs) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, examId, user.id, nowTimestamp, 'in_progress', JSON.stringify([])]
    );
    return { session_id: sessionId };
  };

  const getSession = async (sessionId: string) => {
    const sessions = await db.query<any>('SELECT * FROM exam_sessions WHERE id = ?', [sessionId]);
    const session = sessions[0];
    if (!session) {
      return { status: 404, error: 'Session not found' } as const;
    }
    const exams = await db.query<any>('SELECT * FROM exams WHERE id = ?', [session.exam_id]);
    const exam = exams[0];
    if (!exam) {
      return { status: 404, error: 'Exam not found' } as const;
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
  };

  const submitAnswer = async (sessionId: string, payload: { question_id: string; response: unknown } | undefined) => {
    if (!payload || !payload.question_id) {
      return { status: 400, error: 'question_id required' } as const;
    }
    try {
      await answerQueue.enqueue(async () => {
        await db.query(answersUpsertSql, [
          sessionId,
          payload.question_id,
          JSON.stringify(payload.response)
        ]);
      }, queueSettings.maxQueue);
      return { success: true };
    } catch {
      return { status: 429, error: 'Queue is full' } as const;
    }
  };

  const appendLog = async (sessionId: string, payload: { event: string; detail?: Record<string, unknown> }) => {
    const sessions = await db.query<any>('SELECT logs FROM exam_sessions WHERE id = ?', [sessionId]);
    const current = sessions[0]?.logs ? parseJson<any[]>(sessions[0].logs, []) : [];
    const updated = [
      ...current,
      { event: payload.event, detail: payload.detail ?? {}, at: now().toISOString() }
    ];
    await db.query('UPDATE exam_sessions SET logs = ? WHERE id = ?', [
      JSON.stringify(updated),
      sessionId
    ]);
    return { success: true };
  };

  const appendHeartbeat = async (
    sessionId: string,
    payload: { status?: string; detail?: Record<string, unknown> }
  ) => {
    const sessions = await db.query<any>('SELECT logs FROM exam_sessions WHERE id = ?', [sessionId]);
    const current = sessions[0]?.logs ? parseJson<any[]>(sessions[0].logs, []) : [];
    const updated = [
      ...current,
      { event: 'heartbeat', detail: payload.detail ?? {}, status: payload.status ?? 'ok', at: now().toISOString() }
    ];
    await db.query('UPDATE exam_sessions SET logs = ? WHERE id = ?', [
      JSON.stringify(updated),
      sessionId
    ]);
    return { success: true };
  };

  const submitSession = async (sessionId: string) => {
    try {
      const result = await submitQueue.enqueue(async () => {
        const sessions = await db.query<any>('SELECT * FROM exam_sessions WHERE id = ?', [
          sessionId
        ]);
        const session = sessions[0];
        if (!session) {
          return { status: 404, error: 'Session not found' } as const;
        }

        const questions = await db.query<any>(
          'SELECT q.*, eq.weight FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ?',
          [session.exam_id]
        );
        const answers = await db.query<any>('SELECT * FROM answers WHERE session_id = ?', [
          sessionId
        ]);

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
          await db.query(
            'UPDATE answers SET score = ? WHERE session_id = ? AND question_id = ?',
            [weightedScore, sessionId, question.id]
          );
        }

        const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
        const gradeLetter = computeGradeLetter(normalizedScore);

        await db.query(gradesUpsertSql, [sessionId, normalizedScore, gradeLetter]);
        const endTimestamp = databaseType === 'sqlite' ? toLocalSqliteTimestamp(now()) : now();
        await db.query('UPDATE exam_sessions SET status = ?, end_time = ? WHERE id = ?', [
          'submitted',
          endTimestamp,
          sessionId
        ]);
        return { total_score: normalizedScore, grade_letter: gradeLetter };
      }, queueSettings.maxQueue);
      return result;
    } catch {
      return { status: 429, error: 'Queue is full' } as const;
    }
  };

  const getResults = async (sessionId: string) => {
    const grades = await db.query<any>('SELECT * FROM grades WHERE session_id = ?', [sessionId]);
    if (!grades.length) {
      return { status: 404, error: 'Grade not found' } as const;
    }
    const answers = await db.query<any>('SELECT * FROM answers WHERE session_id = ?', [sessionId]);
    return {
      grade: grades[0],
      answers: answers.map((row) => ({
        ...row,
        response: parseJson(row.response, null)
      }))
    };
  };

  const startSimpleExam = async (payload: { name: string; class_name: string; exam_key?: string; code?: string }) => {
    const { name, class_name: className } = payload;
    const examKey = (payload.exam_key || payload.code || '').trim();
    if (!name || !className || !examKey) {
      return { status: 400, error: 'name, class_name, and exam_key are required' } as const;
    }

    const exams = await db.query<any>('SELECT * FROM exams WHERE simple_key = ?', [examKey]);
    const exam = exams[0];
    if (!exam) {
      return { status: 404, error: 'Exam not found' } as const;
    }

    const settings = parseJson<ExamSettings>(exam.settings, {});
    if (!settings.simpleAccess?.enabled) {
      return { status: 403, error: 'Simple access is disabled' } as const;
    }

    const nowTimestamp = databaseType === 'sqlite' ? toLocalSqliteTimestamp(now()) : now();
    const currentTime = now().getTime();
    const startTime = exam.start_time ? new Date(exam.start_time).getTime() : null;
    const deadline = exam.deadline ? new Date(exam.deadline).getTime() : null;
    if (startTime && currentTime < startTime) {
      return { status: 403, error: 'Exam not started yet' } as const;
    }
    if (deadline && currentTime > deadline) {
      return { status: 403, error: 'Exam deadline passed' } as const;
    }

    const user = await getOrCreateSimpleUser(name, className);
    const attemptsAllowed = settings.attempts ?? 1;
    const existingSessions = await db.query<any>(
      'SELECT * FROM exam_sessions WHERE exam_id = ? AND user_id = ? ORDER BY start_time DESC',
      [exam.id, user.id]
    );
    const inProgress = existingSessions.find((session) => session.status === 'in_progress');
    if (inProgress) {
      return { session_id: inProgress.id };
    }
    if (attemptsAllowed && existingSessions.length >= attemptsAllowed) {
      return { status: 403, error: 'Attempt limit reached' } as const;
    }

    await getCachedQuestions(exam.id).catch(() => null);
    const sessionId = crypto.randomUUID();
    await db.query(
      'INSERT INTO exam_sessions (id, exam_id, user_id, start_time, status, logs) VALUES (?, ?, ?, ?, ?, ?)',
      [sessionId, exam.id, user.id, nowTimestamp, 'in_progress', JSON.stringify([])]
    );
    return { session_id: sessionId };
  };

  const getSimpleSession = async (sessionId: string) => {
    const result = await loadSimpleSession(sessionId);
    if ('error' in result) return result;
    const { session, exam, settings } = result;
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
  };

  return {
    listExams,
    startExam,
    getSession,
    submitAnswer,
    appendLog,
    appendHeartbeat,
    submitSession,
    getResults,
    startSimpleExam,
    getSimpleSession,
    loadSimpleSession
  };
};
