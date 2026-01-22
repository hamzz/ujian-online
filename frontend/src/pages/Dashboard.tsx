import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useSchoolStore } from "../store/school";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const profile = useSchoolStore((state) => state.profile);

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="floating-nav rounded-3xl px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt="Logo" className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-brand-500/90 text-white flex items-center justify-center font-semibold">
                EO
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">{profile?.name || "Ujian Online"}</h1>
              <p className="text-sm text-slate-500">Selamat datang, {user?.email}</p>
            </div>
          </div>
          <button onClick={clear} className="btn-outline rounded-xl px-4 py-2 text-sm font-medium">
            Keluar
          </button>
        </header>

        <section className="relative overflow-hidden rounded-3xl glass-card px-6 py-8 animate-float-in">
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: profile?.bannerUrl
                ? `linear-gradient(120deg, rgba(15,23,42,0.2), rgb(var(--brand-500) / 0.35)), url(${profile.bannerUrl})`
                : "radial-gradient(circle at top right, rgb(var(--brand-500) / 0.25), transparent 60%)"
            }}
          />
          <div className="relative z-10 grid gap-6 md:grid-cols-[1.2fr,1fr] items-center">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
              <h2 className="text-3xl font-semibold text-slate-900">
                Siap untuk ujian hari ini?
              </h2>
              <p className="text-sm text-slate-600">
                Masuk cepat, cek jadwal, dan akses panel sesuai role kamu.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/exam/start" className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold">
                  Masukkan Kode Ujian
                </Link>
                {user?.role !== "student" && (
                  <Link to="/teacher" className="btn-outline rounded-xl px-5 py-2 text-sm font-semibold">
                    Panel Guru
                  </Link>
                )}
              </div>
            </div>
            <div className="grid gap-4">
              <div className="soft-card rounded-2xl p-4 hover-float">
                <div className="text-xs text-slate-500">Role aktif</div>
                <div className="mt-2 text-lg font-semibold capitalize">{user?.role}</div>
              </div>
              <div className="soft-card rounded-2xl p-4 hover-float">
                <div className="text-xs text-slate-500">Akses cepat</div>
                <div className="mt-2 text-sm text-slate-600">Bank soal, sesi ujian, dan laporan.</div>
              </div>
            </div>
          </div>
        </section>

        <main className="grid gap-6 md:grid-cols-2">
          <div className="glass-card rounded-3xl p-6 hover-float">
            <h2 className="text-lg font-semibold">Mulai Ujian</h2>
            <p className="text-sm text-slate-600 mt-2">
              Masukkan kode ujian untuk mulai mengerjakan dengan timer otomatis.
            </p>
            <Link to="/exam/start" className="mt-4 inline-flex btn-primary rounded-xl px-4 py-2 text-sm font-semibold">
              Masukkan Kode
            </Link>
          </div>

          <div className="glass-card rounded-3xl p-6 hover-float space-y-3">
            <h2 className="text-lg font-semibold">Manajemen</h2>
            <p className="text-sm text-slate-600">Akses panel sesuai role.</p>
            <div className="flex flex-col gap-2">
              {user?.role !== "student" && (
                <Link to="/teacher" className="btn-outline rounded-xl px-4 py-2 text-sm font-semibold">
                  Panel Guru
                </Link>
              )}
              {user?.role === "admin" && (
                <Link to="/admin/users" className="btn-outline rounded-xl px-4 py-2 text-sm font-semibold">
                  Kelola User
                </Link>
              )}
            </div>
            <div className="text-sm text-slate-500">Role saat ini: {user?.role}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
