import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { API_URL, apiFetch } from '../api';

type Question = {
  id: string;
  content: string;
  type: string;
  subject_id: string;
  image_urls?: string[];
  options?: string[] | null;
  answer_key?: any;
};

type Subject = {
  id: string;
  name: string;
};

type QuestionResponse = {
  total: number;
  page: number;
  page_size: number;
  data: Question[];
};

const typeOptions = [
  { value: 'multiple_choice', label: 'Pilihan Ganda' },
  { value: 'multiple_select', label: 'Multiple Correct' },
  { value: 'true_false', label: 'Benar / Salah' },
  { value: 'short_answer', label: 'Isian Singkat' },
  { value: 'essay', label: 'Esai' }
];

export default function TeacherQuestions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState({
    subject_id: '',
    type: 'multiple_choice',
    content: '',
    options: '',
    answer: '',
    image1: '',
    image2: '',
    image3: ''
  });
  const [subjectName, setSubjectName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageMessage, setImageMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterSubjectId) params.set('subject_id', filterSubjectId);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      const [questionsData, subjectsData] = await Promise.all([
        apiFetch<QuestionResponse>(`/teacher/questions?${params.toString()}`),
        apiFetch<Subject[]>('/teacher/subjects')
      ]);
      setQuestions(questionsData.data);
      setTotal(questionsData.total);
      setSubjects(subjectsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterSubjectId, search, page, pageSize]);

  const buildAnswerKey = () => {
    if (form.type === 'multiple_choice') return { correct: form.answer };
    if (form.type === 'multiple_select')
      return { correct: form.answer.split(',').map((item) => item.trim()).filter(Boolean) };
    if (form.type === 'true_false') return { correct: form.answer === 'true' };
    if (form.type === 'short_answer') return { correct: form.answer, match: 'exact' };
    return { rubric: form.answer };
  };

  const buildImages = () =>
    [form.image1, form.image2, form.image3].map((item) => item.trim()).filter(Boolean);

  const handleCreate = async () => {
    try {
      const options = form.options
        ? form.options.split('\n').map((item) => item.trim()).filter(Boolean)
        : null;
      const payload = {
        subject_id: form.subject_id,
        type: form.type,
        content: form.content,
        options,
        image_urls: buildImages(),
        answer_key: buildAnswerKey()
      };
      if (editingId) {
        await apiFetch(`/teacher/questions/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/teacher/questions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setForm({
        subject_id: form.subject_id,
        type: 'multiple_choice',
        content: '',
        options: '',
        answer: '',
        image1: '',
        image2: '',
        image3: ''
      });
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateSubject = async () => {
    if (!subjectName) return;
    try {
      await apiFetch('/teacher/subjects', {
        method: 'POST',
        body: JSON.stringify({ name: subjectName })
      });
      setSubjectName('');
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleImport = async () => {
    if (!csvText) return;
    setImportMessage('');
    try {
      const result = await apiFetch<{ inserted: number }>('/teacher/import/questions', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText, subject_id: form.subject_id || undefined })
      });
      setImportMessage(`Berhasil import ${result.inserted} soal.`);
      setCsvText('');
      await load();
    } catch (err: any) {
      setImportMessage(err.message);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    try {
      await apiFetch('/teacher/questions/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selected })
      });
      setSelected([]);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleEdit = (question: Question) => {
    const existingImages = question.image_urls ?? [];
    const answerKey = question.answer_key ?? {};
    const optionsValue = question.options ? question.options.join('\n') : '';
    let answerValue = '';
    if (question.type === 'multiple_select') {
      answerValue = (answerKey.correct ?? []).join(', ');
    } else if (question.type === 'true_false') {
      answerValue = String(answerKey.correct ?? false);
    } else if (question.type === 'essay') {
      answerValue = answerKey.rubric ?? '';
    } else {
      answerValue = String(answerKey.correct ?? '');
    }
    setEditingId(question.id);
    setForm({
      subject_id: question.subject_id,
      type: question.type,
      content: question.content,
      options: optionsValue,
      answer: answerValue,
      image1: existingImages[0] ?? '',
      image2: existingImages[1] ?? '',
      image3: existingImages[2] ?? ''
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    const existing = buildImages();
    const availableSlots = 3 - existing.length;
    const nextFiles = files.slice(0, Math.max(0, availableSlots));
    if (files.length > availableSlots) {
      setImageMessage('Maksimal 3 gambar per soal. Sebagian file tidak dimuat.');
    } else {
      setImageMessage('');
    }
    const dataUrls = await Promise.all(
      nextFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Gagal membaca file'));
            reader.readAsDataURL(file);
          })
      )
    );
    const merged = [...existing, ...dataUrls].slice(0, 3);
    setForm({
      ...form,
      image1: merged[0] ?? '',
      image2: merged[1] ?? '',
      image3: merged[2] ?? ''
    });
    event.target.value = '';
  };

  const clearImageSlot = (index: number) => {
    const images = buildImages();
    images.splice(index, 1);
    setForm({
      ...form,
      image1: images[0] ?? '',
      image2: images[1] ?? '',
      image3: images[2] ?? ''
    });
  };

  const handleExport = async () => {
    const url = new URL('/teacher/export/questions', API_URL);
    if (form.subject_id) url.searchParams.set('subject_id', form.subject_id);
    const token = localStorage.getItem('token');
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
    const text = await response.text();
    navigator.clipboard.writeText(text);
    setImportMessage('CSV hasil export disalin ke clipboard.');
  };

  return (
    <div>
      <PageHeader title="Bank Soal" subtitle="Kelola soal ujian sekolah." />
      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Tambah Soal</h3>
          <div className="space-y-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-slate-500">Tambah Mapel Baru</label>
                <input
                  className="input input-bordered w-full"
                  placeholder="Tambah mapel baru"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                />
              </div>
              <button className="btn btn-outline" onClick={handleCreateSubject}>
                Simpan
              </button>
            </div>
            <label className="text-xs text-slate-500">Mata Pelajaran</label>
            <select
              className="select select-bordered w-full"
              value={form.subject_id}
              onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
            >
              <option value="">Pilih Mapel</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-slate-500">Tipe Soal</label>
            <select
              className="select select-bordered w-full"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value })}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="text-xs text-slate-500">Isi Soal</label>
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Isi soal"
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
            {(form.type === 'multiple_choice' || form.type === 'multiple_select') && (
              <>
                <label className="text-xs text-slate-500">Opsi Jawaban</label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  placeholder="Opsi jawaban (satu per baris)"
                  value={form.options}
                  onChange={(event) => setForm({ ...form, options: event.target.value })}
                />
              </>
            )}
            <label className="text-xs text-slate-500">Gambar Soal</label>
            <div className="grid gap-2">
              <input
                className="input input-bordered w-full"
                placeholder="URL gambar 1 (opsional)"
                value={form.image1}
                onChange={(event) => setForm({ ...form, image1: event.target.value })}
              />
              <input
                className="input input-bordered w-full"
                placeholder="URL gambar 2 (opsional)"
                value={form.image2}
                onChange={(event) => setForm({ ...form, image2: event.target.value })}
              />
              <input
                className="input input-bordered w-full"
                placeholder="URL gambar 3 (opsional)"
                value={form.image3}
                onChange={(event) => setForm({ ...form, image3: event.target.value })}
              />
              <input
                className="file-input file-input-bordered w-full"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
              />
              <p className="text-xs text-slate-500">
                Gambar bisa dari URL atau upload (tersimpan sebagai data URL). Maks 3 gambar.
              </p>
              {imageMessage && <p className="text-xs text-warning">{imageMessage}</p>}
              {buildImages().length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {buildImages().map((url, index) => (
                    <div key={url} className="relative">
                      <img src={url} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      <button
                        type="button"
                        className="btn btn-xs btn-circle absolute -top-2 -right-2"
                        onClick={() => clearImageSlot(index)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label className="text-xs text-slate-500">Kunci Jawaban / Rubrik</label>
            <input
              className="input input-bordered w-full"
              placeholder={
                form.type === 'multiple_select'
                  ? 'Jawaban benar (pisah koma)'
                  : form.type === 'true_false'
                  ? 'true atau false'
                  : form.type === 'essay'
                  ? 'Rubrik penilaian singkat'
                  : 'Jawaban benar'
              }
              value={form.answer}
              onChange={(event) => setForm({ ...form, answer: event.target.value })}
            />
            <div className="flex gap-2">
              <button className="btn btn-primary w-full" onClick={handleCreate}>
                {editingId ? 'Update Soal' : 'Simpan Soal'}
              </button>
              {editingId && (
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      subject_id: form.subject_id,
                      type: 'multiple_choice',
                      content: '',
                      options: '',
                      answer: '',
                      image1: '',
                      image2: '',
                      image3: ''
                    });
                  }}
                >
                  Batal
                </button>
              )}
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
          <div className="divider"></div>
          <h4 className="font-semibold mb-2">Import / Export CSV</h4>
          <p className="text-xs text-slate-500 mb-2">
            Header: subject,type,content,options,answer,explanation. Opsi dan jawaban multi
            pisahkan dengan |.
          </p>
          <label className="text-xs text-slate-500">CSV Input</label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={4}
            placeholder="Paste CSV di sini"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-outline btn-sm" onClick={handleImport}>
              Import CSV
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleExport}>
              Export CSV
            </button>
          </div>
          {importMessage && <p className="text-xs text-slate-500 mt-2">{importMessage}</p>}
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Daftar Soal</h3>
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs text-slate-500">{selected.length} dipilih</p>
            <div className="flex items-center gap-2">
              <input
                className="input input-bordered input-xs"
                placeholder="Cari soal..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="select select-bordered select-xs"
                value={filterSubjectId}
                onChange={(event) => {
                  setFilterSubjectId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Semua Mapel</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                className="select select-bordered select-xs"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 30].map((size) => (
                  <option key={size} value={size}>
                    {size}/hal
                  </option>
                ))}
              </select>
              <button className="btn btn-outline btn-xs" onClick={handleBulkDelete}>
                Hapus Terpilih
              </button>
            </div>
          </div>
          {loading ? (
            <Loading />
          ) : (
            <>
              <div className="space-y-3">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className="border border-slate-200 rounded-xl p-4 flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary mt-1"
                      checked={selected.includes(question.id)}
                      onChange={() => toggleSelected(question.id)}
                    />
                    <div>
                      <p className="text-sm text-slate-500 mb-2">{question.type}</p>
                      <p className="font-medium">{question.content}</p>
                      {question.image_urls && question.image_urls.length > 0 && (
                        <div className="flex gap-2 mt-2">
                          {question.image_urls.map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt="Soal"
                              className="w-12 h-12 object-cover rounded"
                            />
                          ))}
                        </div>
                      )}
                      <button
                        className="btn btn-xs btn-outline mt-3"
                        onClick={() => handleEdit(question)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500">
                  Total {total} soal
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </button>
                  <span className="text-xs text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
