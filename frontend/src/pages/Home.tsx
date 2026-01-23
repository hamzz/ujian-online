import { useAuthStore } from '../store';
import { Link } from 'react-router-dom';
import InfoTable from '../components/InfoTable';

export default function Home() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="glass-panel p-10 rounded-2xl text-center">
        <h1 className="text-3xl font-bold text-neutral">Ujian Online Sekolah</h1>
        <p className="text-slate-500 mt-2">
          Platform ujian dengan bank soal, penilaian otomatis, dan laporan ringkas.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <Link to="/login" className="btn btn-primary">
            Login
          </Link>
          <Link to="/join" className="btn btn-outline">
            Masuk Ujian
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-xl font-semibold">Halo, {user.username}</h2>
        <div className="mt-4">
          <InfoTable
            rows={[
              { label: 'Role', value: user.role },
              { label: 'Email', value: user.email ?? '—' }
            ]}
          />
        </div>
        <p className="text-slate-500 mt-4">
          Pilih menu di kanan atas untuk mulai mengelola ujian atau mengerjakan ujian.
        </p>
      </div>
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="font-semibold text-lg">Checklist MVP</h3>
        <ul className="mt-3 text-sm text-slate-600 space-y-2">
          <li>Auth JWT & role-based access</li>
          <li>Bank soal & ujian</li>
          <li>Ujian siswa dengan timer</li>
          <li>Auto-grading & hasil</li>
        </ul>
      </div>
    </div>
  );
}
