import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type Overview = {
  users: number;
  exams: number;
  sessions: number;
  avg_score: number;
};

type Exam = {
  id: string;
  title: string;
};

type Summary = {
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
};

type ExamStat = {
  id: string;
  title: string;
  code: string;
  attempts: number;
  avg_score: number;
};

type PagedResponse<T> = {
  total: number;
  page: number;
  page_size: number;
  data: T[];
};

export default function Reports() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examStats, setExamStats] = useState<ExamStat[]>([]);
  const [examStatsPage, setExamStatsPage] = useState(1);
  const [examStatsPageSize, setExamStatsPageSize] = useState(10);
  const [examStatsTotal, setExamStatsTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedExam, setSelectedExam] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [overviewData, examsData, statsData] = await Promise.all([
        apiFetch<Overview>('/reports/overview'),
        apiFetch<PagedResponse<Exam>>('/teacher/exams?page=1&page_size=200'),
        apiFetch<PagedResponse<ExamStat>>(
          `/reports/exams?page=${examStatsPage}&page_size=${examStatsPageSize}`
        )
      ]);
      setOverview(overviewData);
      setExams(examsData.data);
      setExamStats(statsData.data);
      setExamStatsTotal(statsData.total);
      if (examsData.data.length) setSelectedExam(examsData.data[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [examStatsPage, examStatsPageSize]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedExam) return;
      try {
        const data = await apiFetch<Summary>(`/reports/exams/${selectedExam}/summary`);
        setSummary(data);
      } catch (err: any) {
        setSummary(null);
      }
    };
    loadSummary();
  }, [selectedExam]);

  if (loading) return <Loading />;

  const range = summary ? Math.max(summary.max - summary.min, 1) : 1;
  const avgPos = summary ? ((summary.avg - summary.min) / range) * 100 : 0;
  const medianPos = summary ? ((summary.median - summary.min) / range) * 100 : 0;
  const examStatsTotalPages = Math.max(1, Math.ceil(examStatsTotal / examStatsPageSize));

  return (
    <div>
      <PageHeader title="Laporan & Analytics" subtitle="Ringkasan performa ujian." />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {overview && (
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <div className="glass-panel p-4 rounded-2xl">
            <p className="text-xs text-slate-500">Total User</p>
            <h3 className="text-2xl font-bold text-neutral">{overview.users}</h3>
            <p className="text-xs text-slate-400 mt-1">Akun aktif dalam sistem</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl">
            <p className="text-xs text-slate-500">Total Ujian</p>
            <h3 className="text-2xl font-bold text-neutral">{overview.exams}</h3>
            <p className="text-xs text-slate-400 mt-1">Ujian dibuat guru</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl">
            <p className="text-xs text-slate-500">Sesi Ujian</p>
            <h3 className="text-2xl font-bold text-neutral">{overview.sessions}</h3>
            <p className="text-xs text-slate-400 mt-1">Total percobaan siswa</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl">
            <p className="text-xs text-slate-500">Rata-rata Skor</p>
            <h3 className="text-2xl font-bold text-primary">
              {overview.avg_score.toFixed(1)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Skor keseluruhan</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="glass-panel p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Ringkasan per Ujian</h3>
              <p className="text-xs text-slate-500">Pilih ujian untuk detail distribusi.</p>
            </div>
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
          </div>
          {summary ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Peserta</p>
                  <p className="text-lg font-semibold">{summary.count}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Rata-rata</p>
                  <p className="text-lg font-semibold text-primary">{summary.avg.toFixed(1)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Median</p>
                  <p className="text-lg font-semibold">{summary.median.toFixed(1)}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Min - Max</p>
                  <p className="text-lg font-semibold">
                    {summary.min.toFixed(1)} - {summary.max.toFixed(1)}
                  </p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-xl p-4 bg-white">
                <p className="text-xs text-slate-500 mb-2">Rentang Skor</p>
                <div className="relative h-3 bg-slate-100 rounded-full">
                  <div
                    className="absolute top-0 h-3 bg-primary/40 rounded-full"
                    style={{ width: `${Math.max(4, avgPos)}%` }}
                  ></div>
                  <div
                    className="absolute -top-2 w-3 h-3 bg-primary rounded-full border border-white"
                    style={{ left: `calc(${avgPos}% - 6px)` }}
                    title="Rata-rata"
                  ></div>
                  <div
                    className="absolute -top-2 w-3 h-3 bg-secondary rounded-full border border-white"
                    style={{ left: `calc(${medianPos}% - 6px)` }}
                    title="Median"
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>{summary.min.toFixed(1)}</span>
                  <span>{summary.max.toFixed(1)}</span>
                </div>
                <div className="flex gap-3 mt-2 text-xs">
                  <span className="badge badge-primary badge-outline">Rata-rata</span>
                  <span className="badge badge-secondary badge-outline">Median</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Belum ada data nilai.</p>
          )}
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Sorotan Ujian</h3>
          <div className="space-y-3">
            {examStats.slice(0, 5).map((exam) => (
              <div key={exam.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{exam.title}</p>
                    <p className="text-xs text-slate-500">Kode {exam.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Avg</p>
                    <p className="font-semibold text-primary">{exam.avg_score.toFixed(1)}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <progress
                    className="progress progress-primary flex-1"
                    value={Math.min(100, exam.avg_score)}
                    max="100"
                  ></progress>
                  <span className="text-xs text-slate-500">{exam.attempts} attempt</span>
                </div>
              </div>
            ))}
            {!examStats.length && <p className="text-sm text-slate-500">Belum ada data ujian.</p>}
          </div>
        </div>
      </div>
      <div className="glass-panel p-5 rounded-2xl mt-6">
        <h3 className="font-semibold mb-3">Statistik Semua Ujian</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Kode</th>
                <th>Attempts</th>
                <th>Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {examStats.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td>{exam.code}</td>
                  <td>{exam.attempts}</td>
                  <td>{exam.avg_score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-slate-500">Total {examStatsTotal} ujian</span>
          <div className="flex items-center gap-2">
            <select
              className="select select-bordered select-xs"
              value={examStatsPageSize}
              onChange={(event) => {
                setExamStatsPageSize(Number(event.target.value));
                setExamStatsPage(1);
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
              onClick={() => setExamStatsPage((prev) => Math.max(1, prev - 1))}
              disabled={examStatsPage <= 1}
            >
              Prev
            </button>
            <span className="text-xs text-slate-500">
              {examStatsPage} / {examStatsTotalPages}
            </span>
            <button
              className="btn btn-outline btn-xs"
              onClick={() => setExamStatsPage((prev) => Math.min(examStatsTotalPages, prev + 1))}
              disabled={examStatsPage >= examStatsTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
