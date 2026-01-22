import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiBaseUrl, apiDownload, apiFetch } from "../api";
import { useAuthStore } from "../store/auth";
import { useSchoolStore } from "../store/school";

type Subject = { id: string; name: string };
type Question = {
  id: string;
  subject_id: string;
  type: string;
  content: string;
  options?: string[] | string | null;
  answer_key?: any;
  metadata?: any;
};
type Exam = { id: string; code: string; title: string; duration_minutes: number };
type Session = {
  id: string;
  user_id: string;
  user_email: string;
  start_time: string;
  end_time: string | null;
  status: string;
  total_score: number | null;
  grade_letter: string | null;
};

type Summary = {
  total_sessions: number;
  submitted_count: number;
  graded_count: number;
  average_score: number | null;
};
type Analytics = {
  totalWeight: number;
  totalSessions: number;
  distribution: Array<{ label: string; count: number }>;
  questions: Array<{
    id: string;
    content: string;
    type: string;
    weight: number;
    attempts: number;
    correct: number;
    difficulty: number | null;
    averageScore: number | null;
  }>;
};

const questionTypes = [
  { value: "multiple_choice", label: "Pilihan Ganda" },
  { value: "multiple_select", label: "PG Banyak Jawaban" },
  { value: "true_false", label: "Benar/Salah" },
  { value: "short_answer", label: "Isian Singkat" },
  { value: "essay", label: "Esai" }
];

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

export default function TeacherPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [tab, setTab] = useState<"subjects" | "questions" | "exams" | "imports">("subjects");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [questionForm, setQuestionForm] = useState({
    subjectId: "",
    type: "multiple_choice",
    content: "",
    options: "",
    answerKey: "",
    mode: "exact",
    keywords: "",
    images: [] as string[]
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({
    title: "",
    subjectId: "",
    instructions: "",
    startTime: "",
    deadline: "",
    durationMinutes: 60,
    shuffleQuestions: true,
    shuffleOptions: true,
    autoSubmitOnCheat: false
  });
  const [selectedQuestions, setSelectedQuestions] = useState<Record<string, number>>({});
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportExamId, setExportExamId] = useState<string>("");
  const token = useAuthStore((state) => state.token);
  const profile = useSchoolStore((state) => state.profile);
  const setProfile = useSchoolStore((state) => state.setProfile);
  const [themeColor, setThemeColor] = useState(profile?.themeColor || "#2563eb");
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeMessage, setThemeMessage] = useState<string | null>(null);

  const subjectMap = useMemo(() => {
    return subjects.reduce<Record<string, string>>((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});
  }, [subjects]);

  const filteredQuestions = useMemo(() => {
    if (!examForm.subjectId) return questions;
    return questions.filter((q) => q.subject_id === examForm.subjectId);
  }, [questions, examForm.subjectId]);
  const allSelected = useMemo(() => {
    if (filteredQuestions.length === 0) return false;
    return filteredQuestions.every((q) => selectedQuestions[q.id] !== undefined);
  }, [filteredQuestions, selectedQuestions]);
  const selectedExam = useMemo(
    () => exams.find((exam) => exam.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [subj, ques, exm] = await Promise.all([
        apiFetch<Subject[]>("/teacher/subjects"),
        apiFetch<Question[]>("/teacher/questions"),
        apiFetch<Exam[]>("/teacher/exams")
      ]);
      setSubjects(subj);
      setQuestions(ques);
      setExams(exm);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (profile?.themeColor) {
      setThemeColor(profile.themeColor);
    }
  }, [profile?.themeColor]);

  async function handleThemeSave() {
    setThemeSaving(true);
    setThemeMessage(null);
    try {
      await apiFetch("/teacher/school-theme", {
        method: "PUT",
        body: JSON.stringify({ themeColor })
      });
      setProfile({
        name: profile?.name || "Ujian Online",
        tagline: profile?.tagline || "",
        logoUrl: profile?.logoUrl || "",
        bannerUrl: profile?.bannerUrl || "",
        themeColor
      });
      setThemeMessage("Warna utama tersimpan.");
    } catch (err: any) {
      setThemeMessage(err.message || "Gagal menyimpan warna.");
    } finally {
      setThemeSaving(false);
    }
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectName.trim()) return;
    await apiFetch("/teacher/subjects", {
      method: "POST",
      body: JSON.stringify({ name: subjectName })
    });
    setSubjectName("");
    loadAll();
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    const { subjectId, type, content, options, answerKey, mode, keywords, images } = questionForm;
    if (!subjectId || !content) return;

    const parsedOptions = options
      ? options
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : null;

    let parsedAnswer: any = {};
    if (type === "multiple_choice") {
      parsedAnswer = { correct: answerKey.trim() };
    } else if (type === "multiple_select") {
      parsedAnswer = { correct: answerKey.split(",").map((v) => v.trim()).filter(Boolean) };
    } else if (type === "true_false") {
      parsedAnswer = { correct: answerKey.trim().toLowerCase() === "true" };
    } else if (type === "short_answer") {
      parsedAnswer = {
        correct: answerKey.trim(),
        mode,
        keywords: keywords.split(",").map((v) => v.trim()).filter(Boolean)
      };
    } else {
      parsedAnswer = { correct: "" };
    }

    await apiFetch("/teacher/questions", {
      method: "POST",
      body: JSON.stringify({
        subjectId,
        type,
        content,
        options: parsedOptions,
        answerKey: parsedAnswer,
        images
      })
    });

    setQuestionForm({
      subjectId,
      type: "multiple_choice",
      content: "",
      options: "",
      answerKey: "",
      mode: "exact",
      keywords: "",
      images: []
    });
    loadAll();
  }

  async function handleUpdateQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!editingQuestionId) return;
    const { type, content, options, answerKey, mode, keywords, images } = questionForm;
    const parsedOptions = options
      ? options
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : null;

    let parsedAnswer: any = {};
    if (type === "multiple_choice") {
      parsedAnswer = { correct: answerKey.trim() };
    } else if (type === "multiple_select") {
      parsedAnswer = { correct: answerKey.split(",").map((v) => v.trim()).filter(Boolean) };
    } else if (type === "true_false") {
      parsedAnswer = { correct: answerKey.trim().toLowerCase() === "true" };
    } else if (type === "short_answer") {
      parsedAnswer = {
        correct: answerKey.trim(),
        mode,
        keywords: keywords.split(",").map((v) => v.trim()).filter(Boolean)
      };
    } else {
      parsedAnswer = { correct: "" };
    }

    await apiFetch(`/teacher/questions/${editingQuestionId}`, {
      method: "PUT",
      body: JSON.stringify({
        content,
        options: parsedOptions,
        answerKey: parsedAnswer,
        images
      })
    });
    setEditingQuestionId(null);
    setQuestionForm({
      subjectId: "",
      type: "multiple_choice",
      content: "",
      options: "",
      answerKey: "",
      mode: "exact",
      keywords: "",
      images: []
    });
    loadAll();
  }

  function toggleQuestion(questionId: string) {
    setSelectedQuestions((prev) => {
      const copy = { ...prev };
      if (copy[questionId]) {
        delete copy[questionId];
      } else {
        copy[questionId] = 1;
      }
      return copy;
    });
  }

  function toggleAllQuestions() {
    setSelectedQuestions((prev) => {
      const next = { ...prev };
      const everySelected = filteredQuestions.length > 0 &&
        filteredQuestions.every((q) => next[q.id] !== undefined);
      if (everySelected) {
        filteredQuestions.forEach((q) => {
          delete next[q.id];
        });
        return next;
      }
      filteredQuestions.forEach((q) => {
        if (next[q.id] === undefined) {
          next[q.id] = 1;
        }
      });
      return next;
    });
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    const {
      title,
      subjectId,
      instructions,
      durationMinutes,
      shuffleQuestions,
      shuffleOptions,
      autoSubmitOnCheat,
      startTime,
      deadline
    } = examForm;
    if (!title || !subjectId) return;

    const questionsPayload = Object.entries(selectedQuestions).map(([questionId, weight]) => ({
      questionId,
      weight
    }));

    function normalizeDateTime(value: string) {
      if (!value) return null;
      const normalized = value.replace("T", " ");
      return normalized.length === 16 ? `${normalized}:00` : normalized;
    }

    await apiFetch("/teacher/exams", {
      method: "POST",
      body: JSON.stringify({
        title,
        instructions,
        subjectId,
        durationMinutes,
        startTime: normalizeDateTime(startTime),
        deadline: normalizeDateTime(deadline),
        settings: {
          shuffleQuestions,
          shuffleOptions,
          autoSubmitOnCheat
        },
        questions: questionsPayload
      })
    });

    setExamForm({
      title: "",
      subjectId,
      instructions: "",
      startTime: "",
      deadline: "",
      durationMinutes: 60,
      shuffleQuestions: true,
      shuffleOptions: true,
      autoSubmitOnCheat: false
    });
    setSelectedQuestions({});
    loadAll();
  }

  async function loadSessions(examId: string) {
    setLoadingSessions(true);
    try {
      const [sessionsData, summaryData] = await Promise.all([
        apiFetch<Session[]>(`/teacher/exams/${examId}/sessions`),
        apiFetch<Summary>(`/teacher/exams/${examId}/summary`)
      ]);
      setSessions(sessionsData);
      setSummary(summaryData);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function loadAnalytics(examId: string) {
    setLoadingAnalytics(true);
    try {
      const data = await apiFetch<Analytics>(`/reports/exams/${examId}/analytics`);
      setAnalytics(data);
    } finally {
      setLoadingAnalytics(false);
    }
  }

  async function downloadStudentReport(sessionId: string) {
    const report = await apiFetch<any>(`/reports/sessions/${sessionId}/report`);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Rapor Ujian: ${report.examTitle}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Siswa: ${report.studentEmail}`, 14, 26);
    doc.text(`Mulai: ${report.startTime || "-"}`, 14, 32);
    doc.text(`Selesai: ${report.endTime || "-"}`, 14, 38);
    doc.text(`Skor: ${report.totalScore ?? "-"} / ${report.totalWeight}`, 14, 44);
    doc.text(`Grade: ${report.gradeLetter ?? "-"}`, 14, 50);

    let y = 58;
    doc.text("Rincian Soal:", 14, y);
    y += 6;

    for (const item of report.questions) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const response =
        item.response === null ? "-" : typeof item.response === "string" ? item.response : JSON.stringify(item.response);
      const scoreText = item.score === null ? "-" : item.score.toFixed(2);
      doc.text(`(${item.type}) Bobot: ${item.weight} | Skor: ${scoreText}`, 14, y);
      y += 6;
      const questionPreview = String(item.content).replace(/\s+/g, " ").slice(0, 120);
      doc.text(`Soal: ${questionPreview}`, 14, y);
      y += 6;
      const responsePreview = response.replace(/\s+/g, " ").slice(0, 120);
      doc.text(`Jawaban: ${responsePreview}`, 14, y);
      y += 8;
    }

    doc.save(`rapor-${report.examId}-${report.sessionId}.pdf`);
  }

  async function downloadStudentReportFile(sessionId: string, format: "csv" | "xlsx") {
    const blob = await apiDownload(`/reports/sessions/${sessionId}/report?format=${format}`);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapor-${sessionId}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadAnalyticsPdf() {
    if (!analytics || !selectedExam) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Analytics Ujian: ${selectedExam.title}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`Total Sessions: ${analytics.totalSessions}`, 14, 28);
    doc.text(`Total Weight: ${analytics.totalWeight}`, 14, 34);

    doc.text("Distribusi Nilai:", 14, 44);
    let y = 50;
    for (const item of analytics.distribution) {
      doc.text(`${item.label}: ${item.count}`, 16, y);
      y += 6;
    }

    y += 4;
    doc.text("Per Soal:", 14, y);
    y += 6;

    for (const item of analytics.questions) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const difficulty = item.difficulty === null ? "-" : `${Math.round(item.difficulty * 100)}%`;
      const avgScore = item.averageScore === null ? "-" : item.averageScore.toFixed(2);
      doc.text(
        `${item.type} | Attempts: ${item.attempts} | Correct: ${item.correct} | Diff: ${difficulty} | Avg: ${avgScore}`,
        14,
        y
      );
      y += 6;
      const preview = item.content.replace(/\s+/g, " ").slice(0, 120);
      doc.text(`Soal: ${preview}`, 14, y);
      y += 8;
    }

    doc.save(`exam-${selectedExam.id}-analytics.pdf`);
  }

  async function uploadFile(path: string, file: File) {
    if (!token) throw new Error("Token tidak ditemukan");
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Gagal upload" }));
      throw new Error(error.error || "Gagal upload");
    }
    return response.json();
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl grid gap-6 lg:grid-cols-[260px,1fr]">
        <aside className="sidebar-glass rounded-3xl p-5 h-fit lg:sticky lg:top-6">
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Panel Guru</h1>
              <p className="text-sm text-slate-500">Kelola bank soal, ujian, dan hasil.</p>
            </div>

            <div className="space-y-2">
              {[
                { id: "subjects", label: "Mata Pelajaran" },
                { id: "questions", label: "Bank Soal" },
                { id: "exams", label: "Ujian" },
                { id: "imports", label: "Import/Export" }
              ].map((item) => (
                <button
                  key={item.id}
                  className={`w-full rounded-2xl px-4 py-2 text-left text-sm font-medium tab-pill ${
                    tab === item.id ? "active" : ""
                  }`}
                  onClick={() => setTab(item.id as any)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-white/80 p-4 space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-700">Tema Kelas</div>
                <p className="text-xs text-slate-500">Ubah warna utama platform.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="h-10 w-14 rounded-lg border border-slate-200"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                />
                <div className="text-xs text-slate-500">{themeColor}</div>
              </div>
              <button
                className="w-full rounded-xl btn-primary py-2 text-sm font-medium"
                onClick={handleThemeSave}
                disabled={themeSaving}
              >
                {themeSaving ? "Menyimpan..." : "Simpan Tema"}
              </button>
              {themeMessage && <p className="text-xs text-slate-500">{themeMessage}</p>}
            </div>

            <button className="w-full rounded-xl btn-outline px-4 py-2 text-sm" onClick={loadAll}>
              Refresh Data
            </button>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="floating-nav rounded-3xl px-6 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Workspace Guru</h2>
              <p className="text-sm text-slate-500">Atur soal, ujian, sesi, dan laporan.</p>
            </div>
            <div className="text-xs text-slate-500">
              {loading ? "Memuat data..." : "Semua data terbaru."}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-slate-500">Memuat data...</p>}

        {tab === "subjects" && (
          <div className="grid gap-6 lg:grid-cols-[1fr,2fr]">
            <form onSubmit={handleAddSubject} className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="font-semibold">Tambah Mata Pelajaran</h2>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                placeholder="Nama mapel"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
              <button className="w-full rounded-xl btn-primary py-2 font-medium">
                Simpan
              </button>
            </form>

            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-semibold">Daftar Mata Pelajaran</h2>
              <div className="mt-4 space-y-2">
                {subjects.map((subject) => (
                  <div key={subject.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span>{subject.name}</span>
                    <button
                      className="text-xs text-red-600"
                      onClick={async () => {
                        await apiFetch(`/teacher/subjects/${subject.id}`, { method: "DELETE" });
                        loadAll();
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
                {subjects.length === 0 && <p className="text-sm text-slate-500">Belum ada mapel.</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "questions" && (
          <div className="grid gap-6 lg:grid-cols-[1.2fr,2fr]">
            <form
              onSubmit={editingQuestionId ? handleUpdateQuestion : handleAddQuestion}
              className="glass-card rounded-3xl p-6 space-y-3"
            >
              <h2 className="font-semibold">
                {editingQuestionId ? "Edit Soal" : "Tambah Soal"}
              </h2>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                value={questionForm.subjectId}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, subjectId: e.target.value }))}
                disabled={Boolean(editingQuestionId)}
              >
                <option value="">Pilih mapel</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                value={questionForm.type}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                {questionTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 min-h-[120px]"
                placeholder="Isi soal"
                value={questionForm.content}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, content: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                placeholder="Opsi jawaban (pisahkan dengan koma)"
                value={questionForm.options}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, options: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                placeholder="Kunci jawaban"
                value={questionForm.answerKey}
                onChange={(e) => setQuestionForm((prev) => ({ ...prev, answerKey: e.target.value }))}
              />
              {questionForm.type === "short_answer" && (
                <>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                    value={questionForm.mode}
                    onChange={(e) => setQuestionForm((prev) => ({ ...prev, mode: e.target.value }))}
                  >
                    <option value="exact">Exact Match</option>
                    <option value="keywords">Keywords</option>
                  </select>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                    placeholder="Keywords (koma)"
                    value={questionForm.keywords}
                    onChange={(e) => setQuestionForm((prev) => ({ ...prev, keywords: e.target.value }))}
                  />
                </>
              )}
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Gambar (maks. 3)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setImageError(null);
                    if (questionForm.images.length >= 3) {
                      setImageError("Maksimal 3 gambar.");
                      return;
                    }
                    try {
                      const result = await uploadFile("/teacher/questions/upload-image", file);
                      setQuestionForm((prev) => ({
                        ...prev,
                        images: [...prev.images, result.url].slice(0, 3)
                      }));
                    } catch (err: any) {
                      setImageError(err.message || "Gagal upload gambar");
                    }
                  }}
                />
                {imageError && <p className="text-sm text-red-600">{imageError}</p>}
                {questionForm.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {questionForm.images.map((url) => (
                      <div key={url} className="relative">
                        <img
                          src={url}
                          alt="Preview"
                          className="h-20 w-full rounded-lg object-cover border border-slate-200"
                        />
                        <button
                          type="button"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs"
                          onClick={() =>
                            setQuestionForm((prev) => ({
                              ...prev,
                              images: prev.images.filter((item) => item !== url)
                            }))
                          }
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="w-full rounded-xl btn-primary py-2 font-medium">
                {editingQuestionId ? "Update Soal" : "Simpan Soal"}
              </button>
              {editingQuestionId && (
                <button
                  type="button"
                  className="w-full rounded-xl btn-outline py-2 text-sm"
                  onClick={() => {
                    setEditingQuestionId(null);
                    setQuestionForm({
                      subjectId: "",
                      type: "multiple_choice",
                      content: "",
                      options: "",
                      answerKey: "",
                      mode: "exact",
                      keywords: "",
                      images: []
                    });
                  }}
                >
                  Batal Edit
                </button>
              )}
            </form>

            <div className="glass-card rounded-3xl p-6">
              <h2 className="font-semibold">Daftar Soal</h2>
              <div className="mt-4 space-y-3">
                {questions.map((question) => (
                  <div key={question.id} className="soft-card rounded-2xl p-3 hover-float">
                    <div className="text-xs text-slate-500">
                      {subjectMap[question.subject_id] || "Mapel"} - {question.type}
                    </div>
                    <p className="mt-2 text-sm">{question.content}</p>
                    <div className="mt-2 text-xs text-slate-500">ID: {question.id}</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="text-xs rounded border border-slate-200 px-2 py-1"
                        onClick={() => {
                          const answer = parseMaybeJson(question.answer_key) || {};
                          const metadata = parseMaybeJson(question.metadata) || {};
                          const optionsValue = Array.isArray(question.options)
                            ? question.options.join(", ")
                            : typeof question.options === "string"
                            ? parseMaybeJson(question.options)?.join?.(", ") || ""
                            : "";

                          let answerKeyValue = "";
                          let mode = "exact";
                          let keywordsValue = "";
                          if (question.type === "multiple_choice") {
                            answerKeyValue = String(answer.correct || "");
                          } else if (question.type === "multiple_select") {
                            answerKeyValue = Array.isArray(answer.correct)
                              ? answer.correct.join(", ")
                              : "";
                          } else if (question.type === "true_false") {
                            answerKeyValue = String(Boolean(answer.correct));
                          } else if (question.type === "short_answer") {
                            answerKeyValue = String(answer.correct || "");
                            mode = answer.mode || "exact";
                            keywordsValue = Array.isArray(answer.keywords)
                              ? answer.keywords.join(", ")
                              : "";
                          }

                          setEditingQuestionId(question.id);
                          setQuestionForm({
                            subjectId: question.subject_id,
                            type: question.type,
                            content: question.content,
                            options: optionsValue,
                            answerKey: answerKeyValue,
                            mode,
                            keywords: keywordsValue,
                            images: Array.isArray(metadata.images) ? metadata.images.slice(0, 3) : []
                          });
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
                {questions.length === 0 && <p className="text-sm text-slate-500">Belum ada soal.</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "exams" && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr,2fr]">
            <form onSubmit={handleCreateExam} className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="font-semibold">Buat Ujian</h2>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                placeholder="Judul ujian"
                value={examForm.title}
                onChange={(e) => setExamForm((prev) => ({ ...prev, title: e.target.value }))}
              />
              <textarea
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 min-h-[90px]"
                placeholder="Instruksi ujian"
                value={examForm.instructions}
                onChange={(e) => setExamForm((prev) => ({ ...prev, instructions: e.target.value }))}
              />
              <select
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                value={examForm.subjectId}
                onChange={(e) => setExamForm((prev) => ({ ...prev, subjectId: e.target.value }))}
              >
                <option value="">Pilih mapel</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  value={examForm.durationMinutes}
                  onChange={(e) =>
                    setExamForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))
                  }
                />
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  value={examForm.startTime}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <input
                type="datetime-local"
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                value={examForm.deadline}
                onChange={(e) => setExamForm((prev) => ({ ...prev, deadline: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={examForm.shuffleQuestions}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))}
                />
                Acak soal
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={examForm.shuffleOptions}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, shuffleOptions: e.target.checked }))}
                />
                Acak opsi PG
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={examForm.autoSubmitOnCheat}
                  onChange={(e) => setExamForm((prev) => ({ ...prev, autoSubmitOnCheat: e.target.checked }))}
                />
                Auto-submit saat curang
              </label>

              <div className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Pilih Soal</div>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAllQuestions}
                      disabled={filteredQuestions.length === 0}
                    />
                    Pilih semua
                  </label>
                </div>
                <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                  {filteredQuestions.map((question) => {
                    const selected = selectedQuestions[question.id] !== undefined;
                    return (
                      <div key={question.id} className="flex items-start justify-between gap-2 text-sm border-b border-slate-100 pb-2">
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleQuestion(question.id)}
                          />
                          <span>{question.content.slice(0, 120)}</span>
                        </label>
                        {selected && (
                          <input
                            type="number"
                            className="w-16 rounded border border-slate-200 px-2 py-1 text-xs"
                            value={selectedQuestions[question.id]}
                            onChange={(e) =>
                              setSelectedQuestions((prev) => ({
                                ...prev,
                                [question.id]: Number(e.target.value || 1)
                              }))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                  {filteredQuestions.length === 0 && (
                    <p className="text-sm text-slate-500">Belum ada soal untuk mapel ini.</p>
                  )}
                </div>
              </div>

              <button className="w-full rounded-xl btn-primary py-2 font-medium">
                Simpan Ujian
              </button>
            </form>

            <div className="space-y-4">
              <div className="glass-card rounded-3xl p-6">
                <h2 className="font-semibold">Daftar Ujian</h2>
                <div className="mt-4 space-y-3">
                  {exams.map((exam) => (
                    <div key={exam.id} className="soft-card rounded-2xl p-3">
                      <div className="text-xs text-slate-500">
                        Kode: <span className="font-semibold text-slate-700">{exam.code}</span>
                      </div>
                      <p className="mt-1 font-medium">{exam.title}</p>
                      <div className="text-xs text-slate-500">Durasi: {exam.duration_minutes} menit</div>
                      <button
                        className="mt-2 text-xs text-brand-700"
                        onClick={() => {
                          setSelectedExamId(exam.id);
                          loadSessions(exam.id);
                          setAnalytics(null);
                        }}
                      >
                        Lihat sesi
                      </button>
                    </div>
                  ))}
                  {exams.length === 0 && <p className="text-sm text-slate-500">Belum ada ujian.</p>}
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6">
                <h2 className="font-semibold">Ringkasan Sesi</h2>
                {selectedExamId ? (
                  <>
                    {loadingSessions && <p className="text-sm text-slate-500 mt-2">Memuat sesi...</p>}
                    {summary && (
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-slate-100 p-3">Total sesi: {summary.total_sessions}</div>
                        <div className="rounded-2xl border border-slate-100 p-3">Submit: {summary.submitted_count}</div>
                        <div className="rounded-2xl border border-slate-100 p-3">Graded: {summary.graded_count}</div>
                        <div className="rounded-2xl border border-slate-100 p-3">
                          Rata-rata: {summary.average_score ? summary.average_score.toFixed(2) : "-"}
                        </div>
                      </div>
                    )}
                    <div className="mt-4 space-y-2">
                      {sessions.map((session) => (
                        <div key={session.id} className="soft-card rounded-2xl p-3 text-sm">
                          <div className="font-medium">{session.user_email}</div>
                          <div className="text-xs text-slate-500">Status: {session.status}</div>
                          <div className="text-xs text-slate-500">
                            Skor: {session.total_score ?? "-"} ({session.grade_letter ?? "-"})
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="text-xs rounded-xl border border-slate-200 px-2 py-1 text-brand-700"
                              onClick={() => downloadStudentReport(session.id)}
                            >
                              Rapor PDF
                            </button>
                            <button
                              className="text-xs rounded-xl border border-slate-200 px-2 py-1"
                              onClick={() => downloadStudentReportFile(session.id, "csv")}
                            >
                              CSV
                            </button>
                            <button
                              className="text-xs rounded-xl border border-slate-200 px-2 py-1"
                              onClick={() => downloadStudentReportFile(session.id, "xlsx")}
                            >
                              Excel
                            </button>
                          </div>
                        </div>
                      ))}
                      {sessions.length === 0 && !loadingSessions && (
                        <p className="text-sm text-slate-500">Belum ada sesi untuk ujian ini.</p>
                      )}
                    </div>
                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Analytics</h3>
                        <button
                          className="text-xs text-brand-700"
                          onClick={() => loadAnalytics(selectedExamId)}
                        >
                          Muat analytics
                        </button>
                      </div>
                      {loadingAnalytics && (
                        <p className="text-sm text-slate-500 mt-2">Memuat analytics...</p>
                      )}
                      {analytics && (
                        <div className="mt-3 space-y-4 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                              onClick={async () => {
                                if (!selectedExamId) return;
                                const blob = await apiDownload(
                                  `/reports/exams/${selectedExamId}/analytics?format=csv`
                                );
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `analytics-${selectedExamId}.csv`;
                                link.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              Download Analytics CSV
                            </button>
                            <button
                              className="rounded-xl btn-primary px-3 py-2 text-xs"
                              onClick={downloadAnalyticsPdf}
                            >
                              Download Analytics PDF
                            </button>
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-white/70 p-4">
                            <div className="text-sm font-medium mb-2">Distribusi Nilai</div>
                            <div className="h-48">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={analytics.distribution}>
                                  <XAxis dataKey="label" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar dataKey="count" fill="rgb(var(--brand-500))" radius={[6, 6, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                              <thead>
                                <tr className="text-slate-500 border-b border-slate-100">
                                  <th className="py-2 pr-3">Soal</th>
                                  <th className="py-2 pr-3">Tipe</th>
                                  <th className="py-2 pr-3">Attempts</th>
                                  <th className="py-2 pr-3">Correct</th>
                                  <th className="py-2 pr-3">Difficulty</th>
                                  <th className="py-2 pr-3">Avg Score</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analytics.questions.map((item) => (
                                  <tr key={item.id} className="border-b border-slate-50">
                                    <td className="py-2 pr-3">
                                      {item.content.slice(0, 80)}
                                    </td>
                                    <td className="py-2 pr-3">{item.type}</td>
                                    <td className="py-2 pr-3">{item.attempts}</td>
                                    <td className="py-2 pr-3">{item.correct}</td>
                                    <td className="py-2 pr-3">
                                      {item.difficulty === null
                                        ? "-"
                                        : `${Math.round(item.difficulty * 100)}%`}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {item.averageScore === null
                                        ? "-"
                                        : item.averageScore.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500 mt-2">Pilih ujian untuk melihat sesi.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "imports" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="font-semibold">Import Siswa (Excel/CSV)</h2>
              <p className="text-sm text-slate-500">
                Kolom: NIS, nama, kelas, email. Password default: Siswa123!
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportError(null);
                  setImportResult(null);
                  try {
                    const result = await uploadFile("/teacher/import/students", file);
                    setImportResult(`Siswa dibuat: ${result.created}, dilewati: ${result.skipped}`);
                  } catch (err: any) {
                    setImportError(err.message || "Gagal import siswa");
                  }
                }}
              />
            </div>

            <div className="glass-card rounded-3xl p-6 space-y-3">
              <h2 className="font-semibold">Import Soal (Excel/CSV)</h2>
              <p className="text-sm text-slate-500">
                Kolom: mapel, type, content, options, answer_key, mode, keywords, explanation.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setImportError(null);
                  setImportResult(null);
                  try {
                    const result = await uploadFile("/teacher/import/questions", file);
                    setImportResult(`Soal dibuat: ${result.created}, dilewati: ${result.skipped}`);
                  } catch (err: any) {
                    setImportError(err.message || "Gagal import soal");
                  }
                }}
              />
            </div>

            <div className="glass-card rounded-3xl p-6 space-y-3 lg:col-span-2">
              <h2 className="font-semibold">Export Nilai Ujian</h2>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2"
                  value={exportExamId}
                  onChange={(e) => setExportExamId(e.target.value)}
                >
                  <option value="">Pilih ujian</option>
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                  disabled={!exportExamId}
                  onClick={async () => {
                    if (!exportExamId) return;
                    const blob = await apiDownload(`/reports/exams/${exportExamId}/scores?format=csv`);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `scores-${exportExamId}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download CSV
                </button>
                <button
                  className="rounded-xl btn-primary px-4 py-2 text-sm"
                  disabled={!exportExamId}
                  onClick={async () => {
                    if (!exportExamId) return;
                    const blob = await apiDownload(`/reports/exams/${exportExamId}/scores?format=xlsx`);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `scores-${exportExamId}.xlsx`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download Excel
                </button>
              </div>
              {importResult && <p className="text-sm text-emerald-600">{importResult}</p>}
              {importError && <p className="text-sm text-red-600">{importError}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
    </div>
  );
}
