import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import { useSchoolStore } from "../store/school";

type User = { id: string; email: string; role: "admin" | "teacher" | "student" };
type SchoolProfile = {
  name: string;
  tagline: string;
  logoUrl: string;
  bannerUrl: string;
  themeColor: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", role: "teacher" });
  const [profile, setProfile] = useState<SchoolProfile>({
    name: "",
    tagline: "",
    logoUrl: "",
    bannerUrl: "",
    themeColor: "#2563eb"
  });
  const setGlobalProfile = useSchoolStore((state) => state.setProfile);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<User[]>("/admin/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Gagal memuat user");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadProfile();
  }, []);

  async function loadProfile() {
    const data = await apiFetch<SchoolProfile>("/admin/school-profile");
    setProfile(data);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/school-profile", {
      method: "PUT",
      body: JSON.stringify(profile)
    });
    setGlobalProfile(profile);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/admin/users", {
      method: "POST",
      body: JSON.stringify(form)
    });
    setForm({ email: "", password: "", role: "teacher" });
    loadUsers();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-semibold">Admin User Management</h1>
          <p className="text-sm text-slate-500">Kelola akun admin, guru, siswa.</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 grid gap-6 lg:grid-cols-[1fr,2fr]">
        <div className="space-y-6">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow p-6 space-y-3">
          <h2 className="font-semibold">Tambah User</h2>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            value={form.role}
            onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
          >
            <option value="admin">Admin</option>
            <option value="teacher">Guru</option>
            <option value="student">Siswa</option>
          </select>
          <button className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium">
            Buat User
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
          </form>

          <form onSubmit={saveProfile} className="bg-white rounded-2xl shadow p-6 space-y-3">
            <h2 className="font-semibold">Identitas Sekolah</h2>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Nama sekolah"
              value={profile.name}
              onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="Tagline"
              value={profile.tagline}
              onChange={(e) => setProfile((prev) => ({ ...prev, tagline: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="URL Logo"
              value={profile.logoUrl}
              onChange={(e) => setProfile((prev) => ({ ...prev, logoUrl: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="URL Banner"
              value={profile.bannerUrl}
              onChange={(e) => setProfile((prev) => ({ ...prev, bannerUrl: e.target.value }))}
            />
            <input
              type="color"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={profile.themeColor}
              onChange={(e) => setProfile((prev) => ({ ...prev, themeColor: e.target.value }))}
            />
            <button className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium">
              Simpan Identitas
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Daftar User</h2>
            <button className="text-sm text-brand-700" onClick={loadUsers}>
              Refresh
            </button>
          </div>
          {loading && <p className="text-sm text-slate-500 mt-3">Memuat...</p>}
          <div className="mt-4 space-y-3">
            {users.map((user) => (
              <div key={user.id} className="border border-slate-100 rounded-xl p-3">
                <div className="text-sm font-medium">{user.email}</div>
                <div className="text-xs text-slate-500 mt-1">Role: {user.role}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="text-xs text-red-600"
                    onClick={async () => {
                      await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" });
                      loadUsers();
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-slate-500">Belum ada user.</p>}
          </div>
        </div>
      </main>
    </div>
  );
}
