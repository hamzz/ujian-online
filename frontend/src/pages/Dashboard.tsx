import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { useSchoolStore } from "../store/school";

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const profile = useSchoolStore((state) => state.profile);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="relative overflow-hidden bg-slate-900 text-white">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: profile?.bannerUrl
              ? `linear-gradient(110deg, rgba(15,23,42,0.8), rgba(37,99,235,0.6)), url(${profile.bannerUrl})`
              : "radial-gradient(circle at top right, #1d4ed8, #0f172a 55%)"
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center font-semibold">
                EO
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">{profile?.name || "Ujian Online"}</h1>
              <p className="text-sm text-slate-200">Selamat datang, {user?.email}</p>
            </div>
          </div>
          <button
            onClick={clear}
            className="rounded-lg border border-white/40 px-4 py-2 text-sm hover:bg-white/10"
          >
            Keluar
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold">Mulai Ujian</h2>
          <p className="text-sm text-slate-600 mt-2">Masuk dengan kode ujian untuk mulai mengerjakan.</p>
          <Link
            to="/exam/start"
            className="mt-4 inline-flex items-center rounded-lg bg-brand-500 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
          >
            Masukkan Kode
          </Link>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow space-y-3">
          <h2 className="text-lg font-semibold">Manajemen</h2>
          <p className="text-sm text-slate-600">Akses panel sesuai role.</p>
          <div className="flex flex-col gap-2">
            {user?.role !== "student" && (
              <Link
                to="/teacher"
                className="inline-flex items-center rounded-lg border border-brand-500 text-brand-700 px-4 py-2 text-sm font-medium hover:bg-brand-50"
              >
                Panel Guru
              </Link>
            )}
            {user?.role === "admin" && (
              <Link
                to="/admin/users"
                className="inline-flex items-center rounded-lg border border-slate-200 text-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Kelola User
              </Link>
            )}
          </div>
          <div className="text-sm text-slate-500">Role saat ini: {user?.role}</div>
        </div>
      </main>
    </div>
  );
}
