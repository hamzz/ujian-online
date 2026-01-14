import { Elysia } from "elysia";
import { query, queryOne } from "../db";
import { gradeAnswer } from "../grading";

function parseMaybeJson(value: any) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function ensureStudent(auth: any) {
  return auth && (auth.role === "student" || auth.role === "admin");
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

function shuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  const rand = seededRandom(hashSeed(seed));
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const studentRoutes = new Elysia({ prefix: "/student" })
  .get("/exams", async ({ auth, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const rows = await query(
      "SELECT id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings FROM exams ORDER BY created_at DESC"
    );
    return rows;
  })
  .get("/exams/code/:code", async ({ auth, params, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const exam = await queryOne<any>(
      "SELECT id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings FROM exams WHERE code = ?",
      [(params as any).code]
    );
    if (!exam) {
      set.status = 404;
      return { error: "Exam not found" };
    }
    return exam;
  })
  .post("/exams/:id/start", async ({ auth, params, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const { id } = params as { id: string };
    const exam = await queryOne<any>(
      "SELECT id, title, instructions, duration_minutes, settings FROM exams WHERE id = ?",
      [id]
    );
    if (!exam) {
      set.status = 404;
      return { error: "Exam not found" };
    }
    const sessionId = crypto.randomUUID();
    await query(
      "INSERT INTO exam_sessions (id, exam_id, user_id, start_time, status) VALUES (?, ?, ?, ?, 'in_progress')",
      [sessionId, id, auth.sub, new Date()]
    );

    const questions = await query<any>(
      "SELECT q.id, q.type, q.content, q.options, q.metadata, eq.position, eq.weight FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.position ASC",
      [id]
    );

    const settings = parseMaybeJson(exam.settings) || {};
    let finalQuestions = questions.map((q: any) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options: parseMaybeJson(q.options),
      metadata: parseMaybeJson(q.metadata),
      weight: q.weight
    }));

    if (settings.shuffleQuestions) {
      finalQuestions = shuffle(finalQuestions, sessionId);
    }

    if (settings.shuffleOptions) {
      finalQuestions = finalQuestions.map((q: any) => {
        if (!Array.isArray(q.options)) return q;
        return { ...q, options: shuffle(q.options, `${sessionId}:${q.id}`) };
      });
    }

    return { sessionId, exam: { ...exam, settings }, questions: finalQuestions };
  })
  .post("/sessions/:id/answer", async ({ auth, params, body, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const { id } = params as { id: string };
    const { questionId, response } = body as any;
    if (!questionId) {
      set.status = 400;
      return { error: "questionId required" };
    }

    await query(
      "INSERT INTO answers (session_id, question_id, response) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE response = VALUES(response)",
      [id, questionId, JSON.stringify(response)]
    );

    return { ok: true };
  })
  .post("/sessions/:id/log", async ({ auth, params, body, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const { id } = params as { id: string };
    const { event, detail, timestamp } = body as any;
    if (!event) {
      set.status = 400;
      return { error: "event required" };
    }
    const session = await queryOne<any>("SELECT logs FROM exam_sessions WHERE id = ?", [id]);
    if (!session) {
      set.status = 404;
      return { error: "Session not found" };
    }
    const current = session.logs ? JSON.parse(session.logs) : [];
    current.push({
      event,
      detail: detail || null,
      timestamp: timestamp || new Date().toISOString()
    });
    await query("UPDATE exam_sessions SET logs = ? WHERE id = ?", [JSON.stringify(current), id]);
    return { ok: true };
  })
  .post("/sessions/:id/finish", async ({ auth, params, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const { id } = params as { id: string };
    const answers = await query<any>(
      "SELECT a.question_id, a.response, q.type, q.answer_key, eq.weight FROM answers a JOIN questions q ON q.id = a.question_id JOIN exam_questions eq ON eq.question_id = q.id JOIN exam_sessions s ON s.exam_id = eq.exam_id WHERE a.session_id = ? AND s.id = ?",
      [id, id]
    );

    let total = 0;
    for (const answer of answers) {
      const score = gradeAnswer(
        answer.type,
        parseMaybeJson(answer.answer_key),
        parseMaybeJson(answer.response)
      );
      const weighted = score * Number(answer.weight || 1);
      total += weighted;
      await query("UPDATE answers SET score = ? WHERE session_id = ? AND question_id = ?", [weighted, id, answer.question_id]);
    }

    const letter = total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : total >= 40 ? "D" : "E";
    await query(
      "INSERT INTO grades (session_id, total_score, grade_letter) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), grade_letter = VALUES(grade_letter)",
      [id, total, letter]
    );
    await query("UPDATE exam_sessions SET status = 'submitted', end_time = ? WHERE id = ?", [new Date(), id]);

    return { sessionId: id, totalScore: total, gradeLetter: letter };
  })
  .get("/sessions/:id/result", async ({ auth, params, set }) => {
    if (!ensureStudent(auth)) {
      set.status = 403;
      return { error: "Student access required" };
    }
    const { id } = params as { id: string };
    const grade = await queryOne<any>("SELECT total_score, grade_letter FROM grades WHERE session_id = ?", [id]);
    if (!grade) {
      set.status = 404;
      return { error: "Result not available" };
    }
    return grade;
  });
