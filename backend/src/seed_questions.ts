import { query, queryOne } from "./db";
import { hashPassword } from "./auth";

async function ensureUser(email: string, password: string, role: "admin" | "teacher" | "student") {
  const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await query(
    "INSERT INTO users (id, email, password_hash, role, profile_data) VALUES (?, ?, ?, ?, ?)",
    [id, email, passwordHash, role, JSON.stringify({})]
  );
  return id;
}

async function ensureSubject(name: string) {
  const existing = await queryOne<{ id: string }>("SELECT id FROM subjects WHERE name = ?", [name]);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await query("INSERT INTO subjects (id, name) VALUES (?, ?)", [id, name]);
  return id;
}

async function ensureTopic(subjectId: string, name: string) {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM topics WHERE subject_id = ? AND name = ?",
    [subjectId, name]
  );
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await query("INSERT INTO topics (id, subject_id, name) VALUES (?, ?, ?)", [id, subjectId, name]);
  return id;
}

async function ensureQuestion(input: {
  subjectId: string;
  topicId?: string | null;
  type: "multiple_choice" | "multiple_select" | "true_false" | "short_answer" | "essay";
  content: string;
  options?: string[] | null;
  answerKey: any;
  explanation?: string | null;
  createdBy: string;
}) {
  const existing = await queryOne<{ id: string }>(
    "SELECT id FROM questions WHERE content = ? AND subject_id = ?",
    [input.content, input.subjectId]
  );
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await query(
    "INSERT INTO questions (id, subject_id, topic_id, type, content, options, answer_key, explanation, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      input.subjectId,
      input.topicId || null,
      input.type,
      input.content,
      input.options ? JSON.stringify(input.options) : null,
      JSON.stringify(input.answerKey),
      input.explanation || null,
      JSON.stringify({}),
      input.createdBy
    ]
  );
  return id;
}

async function ensureExam(input: {
  title: string;
  subjectId: string;
  instructions: string;
  durationMinutes: number;
  settings: any;
  createdBy: string;
}) {
  const existing = await queryOne<{ id: string }>("SELECT id FROM exams WHERE title = ?", [
    input.title
  ]);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  await query(
    "INSERT INTO exams (id, code, title, instructions, subject_id, start_time, duration_minutes, deadline, settings, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      id,
      code,
      input.title,
      input.instructions,
      input.subjectId,
      null,
      input.durationMinutes,
      null,
      JSON.stringify(input.settings),
      input.createdBy
    ]
  );
  return id;
}

async function attachQuestions(examId: string, questionIds: string[]) {
  await query("DELETE FROM exam_questions WHERE exam_id = ?", [examId]);
  let position = 1;
  for (const qid of questionIds) {
    await query(
      "INSERT INTO exam_questions (exam_id, question_id, position, weight) VALUES (?, ?, ?, ?)",
      [examId, qid, position, 1]
    );
    position += 1;
  }
}

async function main() {
  const teacherId = await ensureUser("guru@ujian.local", "Guru123!", "teacher");

  const mathId = await ensureSubject("Matematika");
  const indoId = await ensureSubject("Bahasa Indonesia");
  const topicAljabar = await ensureTopic(mathId, "Aljabar");
  const topicGeometri = await ensureTopic(mathId, "Geometri");
  const topicTeks = await ensureTopic(indoId, "Teks");

  const q1 = await ensureQuestion({
    subjectId: mathId,
    topicId: topicAljabar,
    type: "multiple_choice",
    content: "Jika 2x + 5 = 15, maka nilai x adalah ...",
    options: ["3", "4", "5", "6"],
    answerKey: { correct: "5" },
    explanation: "2x = 10, jadi x = 5.",
    createdBy: teacherId
  });

  const q2 = await ensureQuestion({
    subjectId: mathId,
    topicId: topicGeometri,
    type: "true_false",
    content: "Jumlah sudut segitiga adalah 180 derajat.",
    answerKey: { correct: true },
    explanation: "Sifat dasar segitiga.",
    createdBy: teacherId
  });

  const q3 = await ensureQuestion({
    subjectId: mathId,
    topicId: topicGeometri,
    type: "short_answer",
    content: "Rumus luas persegi adalah ...",
    answerKey: { correct: "s * s", mode: "keywords", keywords: ["s", "s"] },
    explanation: "Luas persegi = sisi x sisi.",
    createdBy: teacherId
  });

  const q4 = await ensureQuestion({
    subjectId: mathId,
    topicId: topicAljabar,
    type: "multiple_select",
    content: "Pilih bilangan prima berikut:",
    options: ["2", "3", "4", "5"],
    answerKey: { correct: ["2", "3", "5"] },
    explanation: "Bilangan prima: 2, 3, 5.",
    createdBy: teacherId
  });

  const q5 = await ensureQuestion({
    subjectId: indoId,
    topicId: topicTeks,
    type: "multiple_choice",
    content: "Tujuan teks prosedur adalah ...",
    options: [
      "Menghibur pembaca",
      "Memberi petunjuk melakukan sesuatu",
      "Menceritakan pengalaman",
      "Menyampaikan pendapat"
    ],
    answerKey: { correct: "Memberi petunjuk melakukan sesuatu" },
    explanation: "Teks prosedur berisi langkah-langkah.",
    createdBy: teacherId
  });

  const q6 = await ensureQuestion({
    subjectId: indoId,
    topicId: topicTeks,
    type: "essay",
    content: "Jelaskan perbedaan teks deskripsi dan teks narasi.",
    answerKey: { correct: "" },
    explanation: "Jawaban bervariasi, dinilai manual.",
    createdBy: teacherId
  });

  const examMathId = await ensureExam({
    title: "Ujian Matematika Dasar",
    subjectId: mathId,
    instructions: "Kerjakan dengan teliti. Pilih jawaban yang paling tepat.",
    durationMinutes: 60,
    settings: { shuffleQuestions: true, shuffleOptions: true, autoSubmitOnCheat: false },
    createdBy: teacherId
  });
  await attachQuestions(examMathId, [q1, q2, q3, q4]);

  const examIndoId = await ensureExam({
    title: "Ujian Bahasa Indonesia",
    subjectId: indoId,
    instructions: "Baca setiap soal dengan cermat sebelum menjawab.",
    durationMinutes: 50,
    settings: { shuffleQuestions: false, shuffleOptions: true, autoSubmitOnCheat: false },
    createdBy: teacherId
  });
  await attachQuestions(examIndoId, [q5, q6]);

  console.log("Seed soal dan ujian selesai:", { examMathId, examIndoId });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
