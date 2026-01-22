import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';
import { useAuthStore } from '../store';

type Notification = {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: 'pending' | 'sent' | 'read';
  created_at: string;
};

type NotificationResponse = {
  total: number;
  page: number;
  page_size: number;
  data: Notification[];
};

export default function Notifications() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', body: '', target_role: 'all', channel: 'in_app' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<NotificationResponse>(
        `/notifications/me?page=${page}&page_size=${pageSize}`
      );
      setItems(data.data);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const handleSend = async () => {
    if (!form.title || !form.body) return;
    try {
      await apiFetch('/notifications', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ title: '', body: '', target_role: 'all', channel: 'in_app' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'PUT' });
    await load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader title="Notifikasi" subtitle="Reminder dan pembaruan ujian." />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {user && (user.role === 'teacher' || user.role === 'admin') && (
        <div className="glass-panel p-5 rounded-2xl mb-6">
          <h3 className="font-semibold mb-3">Kirim Notifikasi</h3>
          <div className="grid gap-3 md:grid-cols-4">
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
            <div>
              <label className="text-xs text-slate-500">Channel</label>
              <select
                className="select select-bordered w-full"
                value={form.channel}
                onChange={(event) => setForm({ ...form, channel: event.target.value })}
              >
                <option value="in_app">In-app</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="btn btn-primary w-full" onClick={handleSend}>
                Kirim
              </button>
            </div>
          </div>
          <label className="text-xs text-slate-500 mt-3">Isi Notifikasi</label>
          <textarea
            className="textarea textarea-bordered w-full mt-3"
            rows={3}
            placeholder="Isi notifikasi"
            value={form.body}
            onChange={(event) => setForm({ ...form, body: event.target.value })}
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
                <span className="badge badge-outline">{item.channel}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">{item.body}</p>
              <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                <span>{new Date(item.created_at).toLocaleString()}</span>
                {item.status !== 'read' && (
                  <button className="btn btn-xs btn-outline" onClick={() => handleRead(item.id)}>
                    Tandai Dibaca
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Total {total} notifikasi</span>
            <div className="flex items-center gap-2">
              <select
                className="select select-bordered select-xs"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
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
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <span className="text-xs text-slate-500">
                {page} / {totalPages}
              </span>
              <button
                className="btn btn-outline btn-xs"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
