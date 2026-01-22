import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type InsightResponse = {
  overview: {
    users: number;
    admins: number;
    teachers: number;
    students: number;
    sessions: number;
    avg_score: number;
    unfinished_sessions: number;
    avg_duration_minutes: number;
    active_teachers: number;
    active_students: number;
    in_exam_students: number;
    in_exam_sessions: number;
  };
  performance: {
    top_students: Array<{ username: string; avg_score: number; attempts: number }>;
    low_students: Array<{ username: string; avg_score: number; attempts: number }>;
  };
  cheating: {
    sessions_with_blur: number;
    total_blur_events: number;
    total_offline_events: number;
    flagged_sessions: Array<{
      session_id: string;
      username: string;
      exam_title: string;
      blur_count: number;
      offline_count: number;
    }>;
  };
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

export default function AdminStats() {
  const [insights, setInsights] = useState<InsightResponse | null>(null);
  const [exams, setExams] = useState<ExamStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [insightData, examsData] = await Promise.all([
          apiFetch<InsightResponse>('/admin/insights'),
          apiFetch<PagedResponse<ExamStat>>('/reports/exams?page=1&page_size=50')
        ]);
        setInsights(insightData);
        setExams(examsData.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Statistik Admin"
        subtitle="Monitoring performa pengguna, ujian, dan indikasi kendala."
      />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {insights && (
        <>
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Total User</p>
              <h3 className="text-2xl font-bold">{insights.overview.users}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Admin {insights.overview.admins} · Guru {insights.overview.teachers} · Siswa{' '}
                {insights.overview.students}
              </p>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Sesi Ujian</p>
              <h3 className="text-2xl font-bold">{insights.overview.sessions}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {insights.overview.unfinished_sessions} masih berlangsung
              </p>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Rata-rata Skor</p>
              <h3 className="text-2xl font-bold text-primary">
                {insights.overview.avg_score.toFixed(1)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Keseluruhan ujian</p>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Durasi Rata-rata</p>
              <h3 className="text-2xl font-bold">{insights.overview.avg_duration_minutes} m</h3>
              <p className="text-xs text-slate-400 mt-1">Sesi selesai</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Guru Aktif (30 menit)</p>
              <h3 className="text-2xl font-bold">{insights.overview.active_teachers}</h3>
              <p className="text-xs text-slate-400 mt-1">Login terakhir 30 menit</p>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Siswa Aktif (30 menit)</p>
              <h3 className="text-2xl font-bold">{insights.overview.active_students}</h3>
              <p className="text-xs text-slate-400 mt-1">Login terakhir 30 menit</p>
            </div>
            <div className="glass-panel p-4 rounded-2xl">
              <p className="text-xs text-slate-500">Sedang Ujian</p>
              <h3 className="text-2xl font-bold">{insights.overview.in_exam_students}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {insights.overview.in_exam_sessions} sesi aktif
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr,1fr] mb-6">
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="font-semibold mb-3">Performa Siswa (Top 5)</h3>
              <div className="space-y-3">
                {insights.performance.top_students.map((item) => (
                  <div key={item.username} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{item.username}</span>
                      <span className="badge badge-primary">
                        {item.avg_score.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{item.attempts} attempt</p>
                  </div>
                ))}
                {!insights.performance.top_students.length && (
                  <p className="text-sm text-slate-500">Belum ada data nilai.</p>
                )}
              </div>
            </div>
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="font-semibold mb-3">Perlu Pendampingan (Bottom 5)</h3>
              <div className="space-y-3">
                {insights.performance.low_students.map((item) => (
                  <div key={item.username} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{item.username}</span>
                      <span className="badge badge-outline">
                        {item.avg_score.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{item.attempts} attempt</p>
                  </div>
                ))}
                {!insights.performance.low_students.length && (
                  <p className="text-sm text-slate-500">Belum ada data nilai.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr,1fr] mb-6">
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="font-semibold mb-3">Indikasi Kecurangan</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Sesi dengan blur</p>
                  <p className="text-lg font-semibold">{insights.cheating.sessions_with_blur}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Total blur</p>
                  <p className="text-lg font-semibold">{insights.cheating.total_blur_events}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-xs text-slate-500">Offline</p>
                  <p className="text-lg font-semibold">{insights.cheating.total_offline_events}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs text-slate-500 mb-2">Sesi paling berisiko</p>
                <div className="space-y-2">
                  {insights.cheating.flagged_sessions.map((session) => (
                    <div
                      key={session.session_id}
                      className="border border-slate-200 rounded-xl p-3 text-sm"
                    >
                      <p className="font-semibold">{session.username}</p>
                      <p className="text-xs text-slate-500">{session.exam_title}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="badge badge-warning">
                          Blur {session.blur_count}
                        </span>
                        <span className="badge badge-outline">
                          Offline {session.offline_count}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!insights.cheating.flagged_sessions.length && (
                    <p className="text-sm text-slate-500">Belum ada indikasi kuat.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="font-semibold mb-3">Statistik Ujian</h3>
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
                    {exams.map((exam) => (
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
