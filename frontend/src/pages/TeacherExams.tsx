import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type Exam = {
  id: string;
  title: string;
  code: string;
  duration_minutes: number;
  start_time?: string | null;
  deadline?: string | null;
  settings?: any;
};

type Question = {
  id: string;
  content: string;
  subject_id: string;
};

type Subject = {
  id: string;
  name: string;
};

type PagedResponse<T> = {
  total: number;
  page: number;
  page_size: number;
  data: T[];
};

export default function TeacherExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examPage, setExamPage] = useState(1);
  const [examPageSize, setExamPageSize] = useState(10);
  const [examTotal, setExamTotal] = useState(0);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPageSize, setQuestionPageSize] = useState(20);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [form, setForm] = useState({
    title: '',
    subject_id: '',
    duration_minutes: 60,
    instructions: '',
    shuffleQuestions: true,
    shuffleOptions: true,
    attempts: 1,
    simpleAccess: false,
    start_time: '',
    deadline: ''
  });

  const subjectLookup = subjects.reduce<Record<string, string>>((acc, subject) => {
    acc[subject.id] = subject.name;
    return acc;
  }, {});

  const filteredQuestions = form.subject_id
    ? questions.filter((question) => question.subject_id === form.subject_id)
    : questions;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const questionParams = new URLSearchParams();
      if (form.subject_id) questionParams.set('subject_id', form.subject_id);
      questionParams.set('page', String(questionPage));
      questionParams.set('page_size', String(questionPageSize));

      const [examsData, questionData, subjectData] = await Promise.all([
        apiFetch<PagedResponse<Exam>>(
          `/teacher/exams?page=${examPage}&page_size=${examPageSize}`
        ),
        apiFetch<PagedResponse<Question>>(`/teacher/questions?${questionParams.toString()}`),
        apiFetch<Subject[]>('/teacher/subjects')
      ]);
      setExams(examsData.data);
      setExamTotal(examsData.total);
      setQuestions(questionData.data);
      setQuestionTotal(questionData.total);
      setSubjects(subjectData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [examPage, examPageSize, questionPage, questionPageSize, form.subject_id]);

  const toggleQuestion = (id: string) => {
    setSelectedQuestions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleSelectAll = () => {
    const ids = filteredQuestions.map((question) => question.id);
    setSelectedQuestions(ids);
  };

  const handleClearAll = () => {
    setSelectedQuestions([]);
  };

  const handleCreate = async () => {
    try {
      const payload = {
        title: form.title,
        subject_id: form.subject_id,
        instructions: form.instructions,
        duration_minutes: Number(form.duration_minutes),
        start_time: form.start_time || null,
        deadline: form.deadline || null,
        settings: {
          shuffleQuestions: form.shuffleQuestions,
          shuffleOptions: form.shuffleOptions,
          perPage: 'single',
          timerMode: 'countdown',
          autoSubmit: true,
          attempts: Number(form.attempts),
          simpleAccess: {
            enabled: form.simpleAccess,
            requireClass: true
          }
        },
        questions: selectedQuestions.map((question_id) => ({ question_id, weight: 1 }))
      };
      if (editingExamId) {
        await apiFetch(`/teacher/exams/${editingExamId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/teacher/exams', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setForm({
        title: '',
        subject_id: form.subject_id,
        duration_minutes: 60,
        instructions: '',
        shuffleQuestions: true,
        shuffleOptions: true,
        attempts: 1,
        simpleAccess: false,
        start_time: '',
        deadline: ''
      });
      setSelectedQuestions([]);
      setEditingExamId(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditExam = async (examId: string) => {
    try {
      const data = await apiFetch<any>(`/teacher/exams/${examId}`);
      setEditingExamId(examId);
      setForm({
        title: data.title,
        subject_id: data.subject_id,
        duration_minutes: data.duration_minutes,
        instructions: data.instructions ?? '',
        shuffleQuestions: data.settings?.shuffleQuestions ?? true,
        shuffleOptions: data.settings?.shuffleOptions ?? true,
        attempts: data.settings?.attempts ?? 1,
        simpleAccess: data.settings?.simpleAccess?.enabled ?? false,
        start_time: data.start_time ? data.start_time.slice(0, 16) : '',
        deadline: data.deadline ? data.deadline.slice(0, 16) : ''
      });
      setSelectedQuestions(data.questions?.map((question: any) => question.id) ?? []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleExam = (id: string) => {
    setSelectedExams((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedExams.length) return;
    try {
      await apiFetch('/teacher/exams/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedExams })
      });
      setSelectedExams([]);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const examTotalPages = Math.max(1, Math.ceil(examTotal / examPageSize));
  const questionTotalPages = Math.max(1, Math.ceil(questionTotal / questionPageSize));

  return (
    <div>
      <PageHeader title="Ujian" subtitle="Buat dan atur ujian untuk siswa." />
      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-2">Buat / Edit Ujian</h3>
          <p className="text-xs text-slate-500 mb-4">
            Ujian aktif hanya di antara waktu mulai dan deadline. Kosongkan untuk tanpa batas.
          </p>
          <div className="space-y-3">
            <label className="text-xs text-slate-500">Judul Ujian</label>
            <input
              className="input input-bordered w-full"
              placeholder="Contoh: UTS Matematika Kelas X"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <label className="text-xs text-slate-500">Mata Pelajaran</label>
            <select
              className="select select-bordered w-full"
              value={form.subject_id}
              onChange={(event) => {
                setForm({ ...form, subject_id: event.target.value });
                setSelectedQuestions([]);
                setQuestionPage(1);
              }}
            >
              <option value="">Pilih Mapel</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-slate-500">Durasi (menit)</label>
            <input
              className="input input-bordered w-full"
              type="number"
              min={5}
              value={form.duration_minutes}
              onChange={(event) =>
                setForm({ ...form, duration_minutes: Number(event.target.value) })
              }
            />
            <label className="text-xs text-slate-500">Mulai (kosongkan jika langsung aktif)</label>
            <input
              className="input input-bordered w-full"
              type="datetime-local"
              value={form.start_time}
              onChange={(event) => setForm({ ...form, start_time: event.target.value })}
            />
            <label className="text-xs text-slate-500">Deadline (kosongkan jika tanpa batas)</label>
            <input
              className="input input-bordered w-full"
              type="datetime-local"
              value={form.deadline}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
            />
            <label className="text-xs text-slate-500">Batas Percobaan</label>
            <input
              className="input input-bordered w-full"
              type="number"
              min={1}
              value={form.attempts}
              onChange={(event) => setForm({ ...form, attempts: Number(event.target.value) })}
            />
            <label className="text-xs text-slate-500">Instruksi untuk Siswa</label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Instruksi"
              value={form.instructions}
              onChange={(event) => setForm({ ...form, instructions: event.target.value })}
            />
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={form.shuffleQuestions}
                onChange={(event) =>
                  setForm({ ...form, shuffleQuestions: event.target.checked })
                }
              />
              <span className="label-text">Acak soal</span>
            </label>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={form.shuffleOptions}
                onChange={(event) =>
                  setForm({ ...form, shuffleOptions: event.target.checked })
                }
              />
              <span className="label-text">Acak opsi</span>
            </label>
            <label className="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={form.simpleAccess}
                onChange={(event) =>
                  setForm({ ...form, simpleAccess: event.target.checked })
                }
              />
              <span className="label-text">Tanpa login (nama + kelas + kode ujian)</span>
            </label>
            <button className="btn btn-primary w-full" onClick={handleCreate}>
              {editingExamId ? 'Update Ujian' : 'Simpan Ujian'}
            </button>
            {editingExamId && (
              <button
                className="btn btn-outline w-full"
                onClick={() => {
                  setEditingExamId(null);
                  setSelectedQuestions([]);
                  setForm({
                    title: '',
                    subject_id: form.subject_id,
                    duration_minutes: 60,
                    instructions: '',
                    shuffleQuestions: true,
                    shuffleOptions: true,
                    attempts: 1,
                    simpleAccess: false,
                    start_time: '',
                    deadline: ''
                  });
                }}
              >
                Batal Edit
              </button>
            )}
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Pilih Soal</h3>
          <div className="flex gap-2 mb-3">
            <button className="btn btn-xs btn-outline" onClick={handleSelectAll}>
              Pilih Semua
            </button>
            <button className="btn btn-xs btn-outline" onClick={handleClearAll}>
              Kosongkan
            </button>
          </div>
          {loading ? (
            <Loading />
          ) : (
            <>
              <div className="space-y-3">
                {filteredQuestions.map((question) => (
                  <label
                    key={question.id}
                    className="flex items-start gap-3 border border-slate-200 rounded-xl p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary mt-1"
                      checked={selectedQuestions.includes(question.id)}
                      onChange={() => toggleQuestion(question.id)}
                    />
                    <span>
                      {question.content}
                      {subjectLookup[question.subject_id] && (
                        <span className="badge badge-outline ml-2">
                          {subjectLookup[question.subject_id]}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500">Total {questionTotal} soal</span>
                <div className="flex items-center gap-2">
                  <select
                    className="select select-bordered select-xs"
                    value={questionPageSize}
                    onChange={(event) => {
                      setQuestionPageSize(Number(event.target.value));
                      setQuestionPage(1);
                    }}
                  >
                    {[10, 20, 30].map((size) => (
                      <option key={size} value={size}>
                        {size}/hal
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => setQuestionPage((prev) => Math.max(1, prev - 1))}
                    disabled={questionPage <= 1}
                  >
                    Prev
                  </button>
                  <span className="text-xs text-slate-500">
                    {questionPage} / {questionTotalPages}
                  </span>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => setQuestionPage((prev) => Math.min(questionTotalPages, prev + 1))}
                    disabled={questionPage >= questionTotalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
          <div className="divider"></div>
          <h3 className="font-semibold mb-3">Ujian Terdaftar</h3>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500">{selectedExams.length} dipilih</p>
            <button className="btn btn-outline btn-xs" onClick={handleBulkDelete}>
              Hapus Terpilih
            </button>
          </div>
          <div className="space-y-3">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="border border-slate-200 rounded-xl p-4 flex items-start gap-3"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary mt-1"
                  checked={selectedExams.includes(exam.id)}
                  onChange={() => toggleExam(exam.id)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{exam.title}</h4>
                    <span className="badge badge-outline">{exam.code}</span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Durasi {exam.duration_minutes} menit
                  </p>
                  <p className="text-xs text-slate-400">
                    {exam.start_time
                      ? `Mulai: ${new Date(exam.start_time).toLocaleString()}`
                      : 'Mulai: bebas'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {exam.deadline
                      ? `Deadline: ${new Date(exam.deadline).toLocaleString()}`
                      : 'Deadline: -'}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() => handleEditExam(exam.id)}
                    >
                      Edit
                    </button>
                    <span className="badge badge-sm">
                      {exam.start_time || exam.deadline
                        ? (() => {
                            const now = Date.now();
                            const start = exam.start_time
                              ? new Date(exam.start_time).getTime()
                              : null;
                            const end = exam.deadline ? new Date(exam.deadline).getTime() : null;
                            if (start && now < start) return 'Belum mulai';
                            if (end && now > end) return 'Berakhir';
                            return 'Aktif';
                          })()
                        : 'Aktif'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-500">Total {examTotal} ujian</span>
            <div className="flex items-center gap-2">
              <select
                className="select select-bordered select-xs"
                value={examPageSize}
                onChange={(event) => {
                  setExamPageSize(Number(event.target.value));
                  setExamPage(1);
                }}
              >
                {[10, 20, 30].map((size) => (
                  <option key={size} value={size}>
                    {size}/hal
                  </option>
                ))}
              </select>
              <button
                className="btn btn-outline btn-xs"
                onClick={() => setExamPage((prev) => Math.max(1, prev - 1))}
                disabled={examPage <= 1}
              >
                Prev
              </button>
              <span className="text-xs text-slate-500">
                {examPage} / {examTotalPages}
              </span>
              <button
                className="btn btn-outline btn-xs"
                onClick={() => setExamPage((prev) => Math.min(examTotalPages, prev + 1))}
                disabled={examPage >= examTotalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
