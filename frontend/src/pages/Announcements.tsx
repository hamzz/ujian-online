import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';
import { useAuthStore } from '../store';

type Announcement = {
  id: string;
  title: string;
  message: string;
  target_role: string;
  created_at: string;
  author_username: string;
};

export default function Announcements() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', message: '', target_role: 'all' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<Announcement[]>('/announcements');
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.title || !form.message) return;
    try {
      await apiFetch('/announcements', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ title: '', message: '', target_role: 'all' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <PageHeader title="Pengumuman" subtitle="Info terbaru untuk kelas." />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {user && (user.role === 'teacher' || user.role === 'admin') && (
        <div className="glass-panel p-5 rounded-2xl mb-6">
          <h3 className="font-semibold mb-3">Buat Pengumuman</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-slate-500">Judul</label>
              <input
                className="input input-bordered w-full"
                placeholder="Judul"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Target</label>
              <select
                className="select select-bordered w-full"
                value={form.target_role}
                onChange={(event) => setForm({ ...form, target_role: event.target.value })}
              >
                <option value="all">Semua</option>
                <option value="teacher">Guru</option>
                <option value="student">Siswa</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" onClick={handleCreate}>
                Kirim
              </button>
            </div>
          </div>
          <label className="text-xs text-slate-500 mt-3">Isi Pengumuman</label>
          <textarea
            className="textarea textarea-bordered w-full mt-3"
            rows={3}
            placeholder="Isi pengumuman"
            value={form.message}
            onChange={(event) => setForm({ ...form, message: event.target.value })}
          />
        </div>
      )}
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="glass-panel p-5 rounded-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{item.title}</h3>
                <span className="badge badge-outline">{item.target_role}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">{item.message}</p>
              <p className="text-xs text-slate-400 mt-3">
                {item.author_username} • {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

