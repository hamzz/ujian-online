import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type Exam = {
  id: string;
  title: string;
  duration_minutes: number;
  code: string;
  start_time?: string;
  deadline?: string;
};

type ExamResponse = {
  total: number;
  page: number;
  page_size: number;
  data: Exam[];
};

export default function StudentExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<ExamResponse>(
        `/student/exams?page=${page}&page_size=${pageSize}`
      );
      setExams(data.data);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const handleStart = async (examId: string) => {
    try {
      const data = await apiFetch<{ session_id: string }>(`/student/exams/${examId}/start`, {
        method: 'POST'
      });
      navigate(`/student/sessions/${data.session_id}`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Ujian Saya" subtitle="Mulai ujian sesuai jadwal." />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="exam-grid">
            {exams.map((exam) => (
              <div key={exam.id} className="glass-panel p-5 rounded-2xl">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{exam.title}</h3>
                  <span className="badge badge-primary">{exam.code}</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Durasi: {exam.duration_minutes} menit
                </p>
                {exam.deadline && (
                  <p className="text-xs text-slate-400 mt-1">
                    Deadline: {new Date(exam.deadline).toLocaleString()}
                  </p>
                )}
                <button
                  className="btn btn-primary btn-sm mt-4"
                  onClick={() => handleStart(exam.id)}
                >
                  Mulai
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-500">Total {total} ujian</span>
            <div className="flex items-center gap-2">
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
  );
}
