import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { API_URL, apiFetch } from '../api';

const themes = [
  { value: 'sekolah', label: 'Default Sekolah' },
  { value: 'soft-sky', label: 'Soft Sky' },
  { value: 'soft-olive', label: 'Soft Olive' },
  { value: 'soft-sand', label: 'Soft Sand' },
  { value: 'soft-rose', label: 'Soft Rose' },
  { value: 'soft-lavender', label: 'Soft Lavender' }
];

type SchoolProfile = {
  name: string;
  tagline?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  theme_color?: string | null;
};

type QueueSettings = {
  answerConcurrency: number;
  submitConcurrency: number;
  maxQueue: number;
};

type RegistrationSettings = {
  enabled: boolean;
  allowed_roles: Array<'admin' | 'teacher' | 'student'>;
};

export default function AdminConfig() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [queueMessage, setQueueMessage] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [form, setForm] = useState<SchoolProfile>({
    name: '',
    tagline: '',
    logo_url: '',
    banner_url: '',
    theme_color: 'sekolah'
  });
  const [queueForm, setQueueForm] = useState<QueueSettings>({
    answerConcurrency: 10,
    submitConcurrency: 3,
    maxQueue: 1000
  });
  const [registrationForm, setRegistrationForm] = useState<RegistrationSettings>({
    enabled: true,
    allowed_roles: ['admin']
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [data, queueData] = await Promise.all([
          apiFetch<SchoolProfile | null>('/admin/school-profile'),
          apiFetch<QueueSettings>('/admin/queue-settings')
        ]);
        const registrationData =
          await apiFetch<RegistrationSettings>('/admin/registration-settings');
        if (data) {
          setForm({
            name: data.name ?? '',
            tagline: data.tagline ?? '',
            logo_url: data.logo_url ?? '',
            banner_url: data.banner_url ?? '',
            theme_color: data.theme_color ?? 'sekolah'
          });
        }
        if (queueData) setQueueForm(queueData);
        if (registrationData) setRegistrationForm(registrationData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaved('');
    setError('');
    try {
      await apiFetch('/admin/school-profile', {
        method: 'PUT',
        body: JSON.stringify(form)
      });
      const theme = form.theme_color || 'sekolah';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      setSaved('Tersimpan.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleQueueSave = async () => {
    setQueueMessage('');
    setError('');
    try {
      const data = await apiFetch<QueueSettings>('/admin/queue-settings', {
        method: 'PUT',
        body: JSON.stringify(queueForm)
      });
      setQueueForm(data);
      setQueueMessage('Queue settings tersimpan.');
    } catch (err: any) {
      setQueueMessage(err.message);
    }
  };

  const handleRegistrationSave = async () => {
    setRegistrationMessage('');
    setError('');
    try {
      const data = await apiFetch<RegistrationSettings>('/admin/registration-settings', {
        method: 'PUT',
        body: JSON.stringify(registrationForm)
      });
      setRegistrationForm(data);
      setRegistrationMessage('Pengaturan registrasi tersimpan.');
    } catch (err: any) {
      setRegistrationMessage(err.message);
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader title="Konfigurasi Sekolah" subtitle="Pengaturan identitas dan tema." />
      {error && <div className="alert alert-error mb-4">{error}</div>}
      {saved && <div className="alert alert-success mb-4">{saved}</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <label className="text-xs text-slate-500">Nama Sekolah</label>
          <input
            className="input input-bordered w-full"
            placeholder="Nama sekolah"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <label className="text-xs text-slate-500">Tagline</label>
          <input
            className="input input-bordered w-full"
            placeholder="Contoh: Sekolah unggul berkarakter"
            value={form.tagline ?? ''}
            onChange={(event) => setForm({ ...form, tagline: event.target.value })}
          />
          <label className="text-xs text-slate-500">URL Logo</label>
          <input
            className="input input-bordered w-full"
            placeholder="https://..."
            value={form.logo_url ?? ''}
            onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
          />
          <label className="text-xs text-slate-500">URL Banner</label>
          <input
            className="input input-bordered w-full"
            placeholder="https://..."
            value={form.banner_url ?? ''}
            onChange={(event) => setForm({ ...form, banner_url: event.target.value })}
          />
          <label className="text-xs text-slate-500">Tema</label>
          <select
            className="select select-bordered w-full"
            value={form.theme_color ?? 'sekolah'}
            onChange={(event) => {
              const theme = event.target.value;
              setForm({ ...form, theme_color: theme });
              document.documentElement.setAttribute('data-theme', theme);
            }}
          >
            {themes.map((theme) => (
              <option key={theme.value} value={theme.value}>
                {theme.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary w-full" onClick={handleSave}>
            Simpan
          </button>
        </div>
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="font-semibold mb-3">Preview</h3>
          <div className="flex items-center gap-3">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-12 h-12 object-cover rounded" />
            ) : (
              <div className="w-12 h-12 bg-slate-100 rounded"></div>
            )}
            <div>
              <p className="font-semibold">{form.name || 'Nama Sekolah'}</p>
              <p className="text-xs text-slate-500">{form.tagline || 'Tagline sekolah'}</p>
            </div>
          </div>
          {form.banner_url && (
            <img src={form.banner_url} alt="Banner" className="w-full mt-4 rounded-xl" />
          )}
          <div className="mt-4">
            <div className="badge badge-primary">Primary</div>
            <div className="badge badge-secondary ml-2">Secondary</div>
          </div>
        </div>
      </div>
      <div className="glass-panel p-6 rounded-2xl mt-6">
        <h3 className="font-semibold mb-3">Queue Settings</h3>
        <p className="text-xs text-slate-500 mb-4">
          Atur batas antrean untuk submit jawaban/ujian saat peak traffic.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs text-slate-500">Answer Concurrency</label>
            <input
              className="input input-bordered w-full"
              type="number"
              min={1}
              value={queueForm.answerConcurrency}
              onChange={(event) =>
                setQueueForm({
                  ...queueForm,
                  answerConcurrency: Number(event.target.value)
                })
              }
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Submit Concurrency</label>
            <input
              className="input input-bordered w-full"
              type="number"
              min={1}
              value={queueForm.submitConcurrency}
              onChange={(event) =>
                setQueueForm({
                  ...queueForm,
                  submitConcurrency: Number(event.target.value)
                })
              }
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Max Queue</label>
            <input
              className="input input-bordered w-full"
              type="number"
              min={10}
              value={queueForm.maxQueue}
              onChange={(event) =>
                setQueueForm({
                  ...queueForm,
                  maxQueue: Number(event.target.value)
                })
              }
            />
          </div>
        </div>
        <button className="btn btn-outline mt-4" onClick={handleQueueSave}>
          Simpan Queue Settings
        </button>
        {queueMessage && <p className="text-xs text-slate-500 mt-2">{queueMessage}</p>}
      </div>
      <div className="glass-panel p-6 rounded-2xl mt-6">
        <h3 className="font-semibold mb-3">Registrasi User</h3>
        <p className="text-xs text-slate-500 mb-4">
          Atur apakah user bisa register sendiri dan role apa saja yang diizinkan.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            className="toggle"
            checked={registrationForm.enabled}
            onChange={(event) =>
              setRegistrationForm({ ...registrationForm, enabled: event.target.checked })
            }
          />
          <span className="text-sm">
            {registrationForm.enabled ? 'Registrasi dibuka' : 'Registrasi ditutup'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(['admin', 'teacher', 'student'] as const).map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={registrationForm.allowed_roles.includes(role)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...registrationForm.allowed_roles, role]
                    : registrationForm.allowed_roles.filter((item) => item !== role);
                  setRegistrationForm({ ...registrationForm, allowed_roles: next });
                }}
                disabled={!registrationForm.enabled}
              />
              {role === 'admin' ? 'Admin' : role === 'teacher' ? 'Guru' : 'Siswa'}
            </label>
          ))}
        </div>
        <button className="btn btn-outline mt-4" onClick={handleRegistrationSave}>
          Simpan Pengaturan Registrasi
        </button>
        {registrationMessage && (
          <p className="text-xs text-slate-500 mt-2">{registrationMessage}</p>
        )}
      </div>
    </div>
  );
}
