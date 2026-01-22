import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { API_URL, apiFetch } from '../api';

type Exam = {
  id: string;
  title: string;
};

type PagedResponse<T> = {
  total: number;
  page: number;
  page_size: number;
  data: T[];
};

type ResultRow = {
  session_id: string;
  username: string;
  status: string;
  start_time: string;
  end_time: string | null;
  total_score: number | null;
  grade_letter: string | null;
};

export default function TeacherResults() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<PagedResponse<Exam>>('/teacher/exams?page=1&page_size=200');
      setExams(data.data);
      if (data.data.length && !selectedExam) setSelectedExam(data.data[0].id);
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
    const loadResults = async () => {
      if (!selectedExam) return;
      try {
        const data = await apiFetch<ResultRow[]>(`/teacher/exams/${selectedExam}/results`);
        setResults(data);
      } catch (err: any) {
        setError(err.message);
      }
    };
    loadResults();
  }, [selectedExam]);

  const handleDownload = async () => {
    if (!selectedExam) return;
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/teacher/exams/${selectedExam}/results.csv`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'hasil-ujian.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Hasil Ujian" subtitle="Lihat dan unduh hasil per siswa." />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      <div className="glass-panel p-5 rounded-2xl">
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <select
            className="select select-bordered"
            value={selectedExam}
            onChange={(event) => setSelectedExam(event.target.value)}
          >
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title}
              </option>
            ))}
          </select>
          <button className="btn btn-outline" onClick={handleDownload}>
            Download CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Status</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th>Skor</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.session_id}>
                  <td>{row.username}</td>
                  <td>{row.status}</td>
                  <td>{row.start_time ? new Date(row.start_time).toLocaleString() : '-'}</td>
                  <td>{row.end_time ? new Date(row.end_time).toLocaleString() : '-'}</td>
                  <td>{row.total_score !== null ? row.total_score.toFixed(1) : '-'}</td>
                  <td>{row.grade_letter ?? '-'}</td>
                </tr>
              ))}
              {!results.length && (
                <tr>
                  <td colSpan={6} className="text-center text-slate-500">
                    Belum ada data hasil.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
