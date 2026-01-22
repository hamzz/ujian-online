import { Link, NavLink } from 'react-router-dom';
import { useAuthStore } from '../store';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `btn btn-ghost btn-sm ${isActive ? 'text-primary' : 'text-base-content'}`;

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();

  return (
    <div className="app-shell">
      <div className="navbar bg-base-100 shadow-sm sticky top-0 z-20">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost text-lg font-semibold">
            Ujian Online
          </Link>
        </div>
        {user && (
          <div className="flex-none gap-2 flex flex-wrap justify-end">
            {user.role === 'admin' && (
              <>
                <NavLink to="/admin/users" className={navClass}>
                  Users
                </NavLink>
                <NavLink to="/admin/config" className={navClass}>
                  Konfigurasi
                </NavLink>
                <NavLink to="/admin/stats" className={navClass}>
                  Statistik
                </NavLink>
                <NavLink to="/announcements" className={navClass}>
                  Pengumuman
                </NavLink>
                <NavLink to="/notifications" className={navClass}>
                  Notifikasi
                </NavLink>
              </>
            )}
            {user.role === 'teacher' && (
              <>
                <NavLink to="/teacher/questions" className={navClass}>
                  Bank Soal
                </NavLink>
                <NavLink to="/teacher/exams" className={navClass}>
                  Ujian
                </NavLink>
                <NavLink to="/teacher/results" className={navClass}>
                  Hasil
                </NavLink>
                <NavLink to="/teacher/grading" className={navClass}>
                  Penilaian
                </NavLink>
                <NavLink to="/reports" className={navClass}>
                  Laporan
                </NavLink>
                <NavLink to="/announcements" className={navClass}>
                  Pengumuman
                </NavLink>
                <NavLink to="/notifications" className={navClass}>
                  Notifikasi
                </NavLink>
              </>
            )}
            {user.role === 'student' && (
              <>
                <NavLink to="/student/exams" className={navClass}>
                  Ujian Saya
                </NavLink>
                <NavLink to="/announcements" className={navClass}>
                  Pengumuman
                </NavLink>
                <NavLink to="/notifications" className={navClass}>
                  Notifikasi
                </NavLink>
              </>
            )}
            <button className="btn btn-outline btn-sm" onClick={logout}>
              Logout
            </button>
          </div>
        )}
      </div>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
