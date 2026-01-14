import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuthStore } from "../store/auth";
import { useSchoolStore } from "../store/school";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const profile = useSchoolStore((state) => state.profile);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [showRegister, setShowRegister] = useState(false);
  const [role, setRole] = useState<"admin" | "teacher" | "student">("admin");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setAuth(result.token, result.user);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login gagal");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
      });
      setShowRegister(false);
    } catch (err: any) {
      setError(err.message || "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 text-white px-4 py-10">
      <div className="absolute inset-0 opacity-70">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: profile?.bannerUrl
              ? `linear-gradient(120deg, rgba(15,23,42,0.85), rgba(37,99,235,0.6)), url(${profile.bannerUrl})`
              : "radial-gradient(circle at top left, #1e3a8a, #020617 55%)"
          }}
        />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl grid gap-8 lg:grid-cols-[1.1fr,1fr] items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Exam platform for schools
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
            {profile?.name || "Ujian Online"}
          </h1>
          <p className="text-lg text-slate-200">
            {profile?.tagline || "Kelola ujian, bank soal, dan nilai dalam satu platform."}
          </p>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <div className="rounded-lg bg-white/10 px-3 py-2">Secure Access</div>
            <div className="rounded-lg bg-white/10 px-3 py-2">Realtime Monitoring</div>
            <div className="rounded-lg bg-white/10 px-3 py-2">Auto Grading</div>
          </div>
        </div>

        <div className="w-full max-w-lg bg-white text-slate-900 shadow-2xl rounded-3xl p-8 border border-white/40 backdrop-blur">
          <div className="flex items-center gap-3">
            {profile?.logoUrl ? (
              <img src={profile.logoUrl} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-semibold">
                EO
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">{profile?.name || "Ujian Online"}</h1>
              <p className="text-sm text-slate-500">Masuk untuk mengakses dashboard.</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-slate-600">Email</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Password</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="w-full rounded-lg text-white py-2 font-medium transition"
            style={{ backgroundColor: profile?.themeColor || "#2563eb" }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
          </form>

          <button
            className="mt-4 text-sm text-brand-700 hover:underline"
            onClick={() => setShowRegister((prev) => !prev)}
          >
            {showRegister ? "Tutup pendaftaran" : "Daftarkan akun baru (bootstrap)"}
          </button>

          {showRegister && (
            <form onSubmit={handleRegister} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div>
                <label className="text-sm text-slate-600">Role</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                >
                  <option value="admin">Admin</option>
                  <option value="teacher">Guru</option>
                  <option value="student">Siswa</option>
                </select>
              </div>
              <button
                className="w-full rounded-lg border border-brand-500 text-brand-700 py-2 font-medium hover:bg-brand-50 transition"
                type="submit"
                disabled={loading}
              >
                Buat Akun
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
