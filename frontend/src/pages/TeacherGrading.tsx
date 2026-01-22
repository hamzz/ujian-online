import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type Submission = {
  session_id: string;
  question_id: string;
  content: string;
  response: any;
  score: number | null;
  exam_title: string;
  username: string;
};

export default function TeacherGrading() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<Submission[]>('/teacher/essay-submissions');
      setSubmissions(data);
      if (data.length && !selected) setSelected(data[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const responseValue = selected.response;
    if (responseValue && typeof responseValue === 'object') {
      setComment(responseValue.comment ?? '');
      setScore(Number(selected.score ?? 0));
    } else {
      setComment('');
      setScore(Number(selected.score ?? 0));
    }
  }, [selected]);

  const handleSave = async () => {
    if (!selected) return;
    await apiFetch(`/teacher/essay-submissions/${selected.session_id}/${selected.question_id}`, {
      method: 'PUT',
      body: JSON.stringify({ score, comment })
    });
    await load();
  };

  const responseText = useMemo(() => {
    if (!selected) return '';
    const value = selected.response;
    if (value && typeof value === 'object' && 'value' in value) return String(value.value ?? '');
    return String(value ?? '');
  }, [selected]);

  return (
    <div>
      <PageHeader
        title="Penilaian Esai"
        subtitle="Review jawaban esai dan berikan skor manual."
      />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {loading ? (
        <Loading />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
          <div className="glass-panel p-4 rounded-2xl">
            <h3 className="font-semibold mb-3">Daftar Jawaban</h3>
            <div className="space-y-2 max-h-[520px] overflow-auto">
              {submissions.map((item) => (
                <button
                  key={`${item.session_id}-${item.question_id}`}
                  className={`btn btn-sm btn-outline w-full justify-start ${
                    selected?.session_id === item.session_id &&
                    selected?.question_id === item.question_id
                      ? 'btn-active'
                      : ''
                  }`}
                  onClick={() => setSelected(item)}
                >
                  <span className="truncate">{item.exam_title} - {item.username}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="glass-panel p-6 rounded-2xl">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-slate-500">{selected.exam_title}</p>
                  <h2 className="text-lg font-semibold">{selected.content}</h2>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
                  {responseText || 'Tidak ada jawaban.'}
                </div>
                <div className="grid gap-3 md:grid-cols-[120px,1fr]">
                  <div>
                    <label className="text-xs text-slate-500">Skor</label>
                    <input
                      className="input input-bordered w-full"
                      type="number"
                      value={score}
                      onChange={(event) => setScore(Number(event.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Komentar</label>
                    <input
                      className="input input-bordered w-full"
                      placeholder="Komentar"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={handleSave}>
                  Simpan Nilai
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Tidak ada jawaban esai.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
