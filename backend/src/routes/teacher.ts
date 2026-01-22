import { Elysia } from "elysia";
import * as XLSX from "xlsx";
import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { query, queryOne } from "../db";
import { gradeAnswer } from "../grading";
import { hashPassword } from "../auth";

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

function ensureTeacher(auth: any) {
  return auth && (auth.role === "teacher" || auth.role === "admin");
}

export const teacherRoutes = new Elysia({ prefix: "/teacher" })
  .get("/questions", async ({ auth, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const rows = await query(
      "SELECT id, subject_id, topic_id, type, content, options, answer_key, explanation, metadata, created_at FROM questions ORDER BY created_at DESC"
    );
    return rows;
  })
  .post("/questions/upload-image", async ({ auth, request, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      set.status = 400;
      return { error: "File required" };
    }
    const blob = file as Blob;
    const type = blob.type || "";
    if (!type.startsWith("image/")) {
      set.status = 400;
      return { error: "Only image files allowed" };
    }
    const arrayBuffer = await blob.arrayBuffer();
    const extension = extname((file as any).name || "") || ".png";
    const filename = `${crypto.randomUUID()}${extension}`;
    const uploadDir = join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });
    await Bun.write(join(uploadDir, filename), new Uint8Array(arrayBuffer));
    return { url: `/public/uploads/${basename(filename)}` };
  })
  .get("/subjects", async ({ auth, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    return query("SELECT id, name, created_at FROM subjects ORDER BY created_at DESC");
  })
  .post("/subjects", async ({ auth, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { name } = body as any;
    if (!name) {
      set.status = 400;
      return { error: "name required" };
    }
    const id = crypto.randomUUID();
    await query("INSERT INTO subjects (id, name) VALUES (?, ?)", [id, name]);
    return { id };
  })
  .put("/subjects/:id", async ({ auth, params, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { name } = body as any;
    if (!name) {
      set.status = 400;
      return { error: "name required" };
    }
    await query("UPDATE subjects SET name = ? WHERE id = ?", [name, (params as any).id]);
    return { id: (params as any).id };
  })
  .delete("/subjects/:id", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    await query("DELETE FROM subjects WHERE id = ?", [(params as any).id]);
    return { id: (params as any).id };
  })
  .get("/classes", async ({ auth, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    return query("SELECT id, level, major, rombel, created_at FROM classes ORDER BY created_at DESC");
  })
  .post("/classes", async ({ auth, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { level, major, rombel } = body as any;
    if (!level || !major || !rombel) {
      set.status = 400;
      return { error: "level, major, rombel required" };
    }
    const id = crypto.randomUUID();
    await query("INSERT INTO classes (id, level, major, rombel) VALUES (?, ?, ?, ?)", [
      id,
      level,
      major,
      rombel
    ]);
    return { id };
  })
  .put("/classes/:id", async ({ auth, params, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { level, major, rombel } = body as any;
    if (!level || !major || !rombel) {
      set.status = 400;
      return { error: "level, major, rombel required" };
    }
    await query("UPDATE classes SET level = ?, major = ?, rombel = ? WHERE id = ?", [
      level,
      major,
      rombel,
      (params as any).id
    ]);
    return { id: (params as any).id };
  })
  .delete("/classes/:id", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    await query("DELETE FROM classes WHERE id = ?", [(params as any).id]);
    return { id: (params as any).id };
  })
  .get("/topics", async ({ auth, query: qs, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const subjectId = (qs as any).subjectId;
    if (subjectId) {
      return query(
        "SELECT id, subject_id, name, created_at FROM topics WHERE subject_id = ? ORDER BY created_at DESC",
        [subjectId]
      );
    }
    return query("SELECT id, subject_id, name, created_at FROM topics ORDER BY created_at DESC");
  })
  .post("/topics", async ({ auth, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { subjectId, name } = body as any;
    if (!subjectId || !name) {
      set.status = 400;
      return { error: "subjectId, name required" };
    }
    const id = crypto.randomUUID();
    await query("INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)", [id, subjectId, name]);
    return { id };
  })
  .put("/topics/:id", async ({ auth, params, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { name } = body as any;
    if (!name) {
      set.status = 400;
      return { error: "name required" };
    }
    await query("UPDATE topics SET name = ? WHERE id = ?", [name, (params as any).id]);
    return { id: (params as any).id };
  })
  .delete("/topics/:id", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    await query("DELETE FROM topics WHERE id = ?", [(params as any).id]);
    return { id: (params as any).id };
  })
  .post("/import/students", async ({ auth, request, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      set.status = 400;
      return { error: "File required" };
    }

    const buffer = await (file as Blob).arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const normalized: Record<string, any> = {};
      Object.keys(row).forEach((key) => {
        normalized[key.trim().toLowerCase()] = row[key];
      });

      const nis = String(normalized["nis"] || "").trim();
      const name = String(normalized["nama"] || normalized["name"] || "").trim();
      const kelasRaw = String(normalized["kelas"] || "").trim();
      const email = String(normalized["email"] || "").trim();
      if (!email) {
        skipped += 1;
        continue;
      }

      const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
      if (existing) {
        skipped += 1;
        continue;
      }

      let level = kelasRaw || "-";
      let major = "-";
      let rombel = "-";
      if (kelasRaw.includes("/")) {
        const parts = kelasRaw.split("/").map((part) => part.trim());
        [level, major, rombel] = [parts[0] || "-", parts[1] || "-", parts[2] || "-"];
      } else if (kelasRaw.includes("-")) {
        const parts = kelasRaw.split("-").map((part) => part.trim());
        [level, major, rombel] = [parts[0] || "-", parts[1] || "-", parts[2] || "-"];
      }

      let classId: string | null = null;
      if (kelasRaw) {
        const classRow = await queryOne<{ id: string }>(
          "SELECT id FROM classes WHERE level = ? AND major = ? AND rombel = ?",
          [level, major, rombel]
        );
        if (classRow) {
          classId = classRow.id;
        } else {
          classId = crypto.randomUUID();
          await query("INSERT INTO classes (id, level, major, rombel) VALUES (?, ?, ?, ?)", [
            classId,
            level,
            major,
            rombel
          ]);
        }
      }

      const userId = crypto.randomUUID();
      const hashed = await hashPassword("Siswa123!");
      await query(
        "INSERT INTO users (id, email, password_hash, role, profile_data) VALUES (?, ?, ?, 'student', ?)",
        [
          userId,
          email,
          hashed,
          JSON.stringify({ nis, name, classId, classLabel: kelasRaw })
        ]
      );
      created += 1;
    }

    return { created, skipped };
  })
  .post("/import/questions", async ({ auth, request, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof (file as any).arrayBuffer !== "function") {
      set.status = 400;
      return { error: "File required" };
    }

    const buffer = await (file as Blob).arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    function parseList(value: string) {
      if (!value) return [];
      if (value.includes("|")) return value.split("|").map((v) => v.trim()).filter(Boolean);
      return value.split(",").map((v) => v.trim()).filter(Boolean);
    }

    function parseBoolean(value: string) {
      const normalized = value.trim().toLowerCase();
      return normalized === "true" || normalized === "1" || normalized === "benar";
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const normalized: Record<string, any> = {};
      Object.keys(row).forEach((key) => {
        normalized[key.trim().toLowerCase()] = row[key];
      });

      const subjectName = String(normalized["mapel"] || normalized["subject"] || "").trim();
      const type = String(normalized["type"] || "").trim() || "multiple_choice";
      const content = String(normalized["content"] || normalized["soal"] || "").trim();
      const optionsRaw = String(normalized["options"] || normalized["opsi"] || "").trim();
      const answerRaw = String(normalized["answer_key"] || normalized["kunci"] || "").trim();
      const explanation = String(normalized["explanation"] || normalized["pembahasan"] || "").trim();
      const mode = String(normalized["mode"] || "").trim().toLowerCase() || "exact";
      const keywordsRaw = String(normalized["keywords"] || "").trim();

      if (!subjectName || !content) {
        skipped += 1;
        continue;
      }

      let subject = await queryOne<{ id: string }>("SELECT id FROM subjects WHERE name = ?", [
        subjectName
      ]);
      if (!subject) {
        const subjectId = crypto.randomUUID();
        await query("INSERT INTO subjects (id, name) VALUES (?, ?)", [subjectId, subjectName]);
        subject = { id: subjectId };
      }

      const options = optionsRaw ? parseList(optionsRaw) : null;
      let answerKey: any = {};
      if (type === "multiple_choice") {
        answerKey = { correct: answerRaw };
      } else if (type === "multiple_select") {
        answerKey = { correct: parseList(answerRaw) };
      } else if (type === "true_false") {
        answerKey = { correct: parseBoolean(answerRaw) };
      } else if (type === "short_answer") {
        answerKey = { correct: answerRaw, mode, keywords: parseList(keywordsRaw) };
      } else {
        answerKey = { correct: "" };
      }

      const questionId = crypto.randomUUID();
      await query(
        "INSERT INTO questions (id, subject_id, topic_id, type, content, options, answer_key, explanation, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          questionId,
          subject.id,
          null,
          type,
          content,
          options ? JSON.stringify(options) : null,
          JSON.stringify(answerKey),
          explanation || null,
          JSON.stringify({}),
          auth.sub
        ]
      );
      created += 1;
    }

    return { created, skipped };
  })
  .post("/questions", async ({ auth, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { subjectId, topicId, type, content, options, answerKey, explanation, metadata, images } =
      body as any;
    if (!subjectId || !type || !content || !answerKey) {
      set.status = 400;
      return { error: "subjectId, type, content, answerKey required" };
    }
    const safeMetadata = metadata || {};
    if (Array.isArray(images)) {
      safeMetadata.images = images.slice(0, 3);
    }
    const id = crypto.randomUUID();
    await query(
      "INSERT INTO questions (id, subject_id, topic_id, type, content, options, answer_key, explanation, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        subjectId,
        topicId || null,
        type,
        content,
        options ? JSON.stringify(options) : null,
        JSON.stringify(answerKey),
        explanation || null,
        JSON.stringify(safeMetadata),
        auth.sub
      ]
    );
    return { id };
  })
  .put("/questions/:id", async ({ auth, params, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { id } = params as { id: string };
    const { content, options, answerKey, explanation, metadata, images } = body as any;
    const safeMetadata = metadata || {};
    if (Array.isArray(images)) {
      safeMetadata.images = images.slice(0, 3);
    }
    await query(
      "UPDATE questions SET content = ?, options = ?, answer_key = ?, explanation = ?, metadata = ? WHERE id = ?",
      [
        content,
        options ? JSON.stringify(options) : null,
        answerKey ? JSON.stringify(answerKey) : null,
        explanation || null,
        JSON.stringify(safeMetadata),
        id
      ]
    );
    return { id };
  })
  .delete("/questions/:id", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { id } = params as { id: string };
    await query("DELETE FROM questions WHERE id = ?", [id]);
    return { id };
  })
  .get("/exams", async ({ auth, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const rows = await query(
      "SELECT id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings, created_at FROM exams ORDER BY created_at DESC"
    );
    return rows;
  })
  .post("/exams", async ({ auth, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { title, instructions, subjectId, startTime, durationMinutes, deadline, settings, questions } = body as any;
    if (!title || !subjectId || !durationMinutes) {
      set.status = 400;
      return { error: "title, subjectId, durationMinutes required" };
    }
    const id = crypto.randomUUID();
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await query(
      "INSERT INTO exams (id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        code,
        title,
        instructions || null,
        subjectId,
        startTime || null,
        durationMinutes,
        deadline || null,
        JSON.stringify(settings || {}),
        auth.sub
      ]
    );

    if (Array.isArray(questions)) {
      let position = 1;
      for (const item of questions) {
        await query(
          "INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)",
          [id, item.questionId, position, item.weight || 1]
        );
        position += 1;
      }
    }

    return { id, code };
  })
  .get("/exams/:id", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const exam = await queryOne<any>(
      "SELECT id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings FROM exams WHERE id = ?",
      [(params as any).id]
    );
    if (!exam) {
      set.status = 404;
      return { error: "Exam not found" };
    }
    const questions = await query<any>(
      "SELECT eq.question_id, eq.position, eq.weight, q.content, q.type FROM exam_questions eq JOIN questions q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.position ASC",
      [(params as any).id]
    );
    return { ...exam, questions };
  })
  .get("/exams/:id/summary", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const summary = await queryOne<any>(
      "SELECT COUNT(*) as total_sessions, SUM(status = 'submitted') as submitted_count, SUM(status = 'graded') as graded_count, AVG(g.total_score) as average_score FROM exam_sessions s LEFT JOIN grades g ON g.session_id = s.id WHERE s.exam_id = ?",
      [(params as any).id]
    );
    return summary || {
      total_sessions: 0,
      submitted_count: 0,
      graded_count: 0,
      average_score: null
    };
  })
  .get("/exams/:id/sessions", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const rows = await query(
      "SELECT s.id, s.user_id, u.email as user_email, s.start_time, s.end_time, s.status, g.total_score, g.grade_letter FROM exam_sessions s JOIN users u ON u.id = s.user_id LEFT JOIN grades g ON g.session_id = s.id WHERE s.exam_id = ? ORDER BY s.start_time DESC",
      [(params as any).id]
    );
    return rows;
  })
  .put("/exams/:id/questions", async ({ auth, params, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { questions } = body as any;
    if (!Array.isArray(questions)) {
      set.status = 400;
      return { error: "questions array required" };
    }
    const examId = (params as any).id;
    await query("DELETE FROM exam_questions WHERE exam_id = ?", [examId]);
    let position = 1;
    for (const item of questions) {
      await query(
        "INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)",
        [examId, item.questionId, position, item.weight || 1]
      );
      position += 1;
    }
    return { id: examId };
  })
  .post("/sessions/:id/grade", async ({ auth, params, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { id } = params as { id: string };
    const { totalScore, gradeLetter, feedback } = body as any;
    if (totalScore === undefined || !gradeLetter) {
      set.status = 400;
      return { error: "totalScore and gradeLetter required" };
    }
    await query(
      "INSERT INTO grades (session_id, total_score, grade_letter, graded_by, feedback) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE total_score = VALUES(total_score), grade_letter = VALUES(grade_letter), graded_by = VALUES(graded_by), feedback = VALUES(feedback)",
      [id, totalScore, gradeLetter, auth.sub, feedback || null]
    );
    await query("UPDATE exam_sessions SET status = 'graded' WHERE id = ?", [id]);
    return { id };
  })
  .post("/sessions/:id/auto-grade", async ({ auth, params, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
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
    await query("UPDATE exam_sessions SET status = 'graded' WHERE id = ?", [id]);
    return { id, totalScore: total, gradeLetter: letter };
  })
  .put("/school-theme", async ({ auth, body, set }) => {
    if (!ensureTeacher(auth)) {
      set.status = 403;
      return { error: "Teacher access required" };
    }
    const { themeColor } = body as any;
    if (!themeColor) {
      set.status = 400;
      return { error: "themeColor required" };
    }
    const existing = await queryOne<any>("SELECT id FROM school_profile WHERE id = 1");
    if (existing) {
      await query("UPDATE school_profile SET theme_color = ? WHERE id = 1", [themeColor]);
    } else {
      await query(
        "INSERT INTO school_profile (id, name, tagline, logo_url, banner_url, theme_color) VALUES (1, ?, ?, ?, ?, ?)",
        ["Ujian Online", "Platform ujian sekolah", null, null, themeColor]
      );
    }
    return { ok: true };
  });
