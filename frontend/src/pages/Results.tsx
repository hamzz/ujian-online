import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type ResultPayload = {
  grade: { total_score: number; grade_letter: string };
  answers: Array<{ question_id: string; score: number; response: any }>;
};

export default function Results() {
  const { sessionId } = useParams();
  const [result, setResult] = useState<ResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<ResultPayload>(`/student/sessions/${sessionId}/results`);
        setResult(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) load();
  }, [sessionId]);

  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!result) return null;

  const score = Number(result.grade.total_score);

  return (
    <div>
      <PageHeader
        title="Hasil Ujian"
        subtitle="Ringkasan skor otomatis."
      />
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Nilai akhir</p>
            <h2 className="text-3xl font-bold text-primary">
              {Number.isFinite(score) ? score.toFixed(1) : '0.0'}
            </h2>
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-500">Grade</p>
            <span className="badge badge-lg badge-primary">
              {result.grade.grade_letter}
            </span>
          </div>
        </div>
        <div className="divider"></div>
        <h3 className="font-semibold mb-3">Detail Jawaban</h3>
        <div className="space-y-2">
          {result.answers.map((answer) => (
            <div key={answer.question_id} className="flex items-center justify-between">
              <span className="text-sm">{answer.question_id}</span>
              <span className="badge badge-outline">Score {answer.score ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
