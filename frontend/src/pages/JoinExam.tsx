import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { apiFetch } from '../api';

export default function JoinExam() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        class_name: className.trim(),
        code: code.trim().toUpperCase()
      };
      const data = await apiFetch<{ session_id: string }>('/public/exams/start', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      navigate(`/public/sessions/${data.session_id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Masuk Ujian"
        subtitle="Masukkan nama, kelas, dan kode ujian dari guru."
      />
      <div className="glass-panel p-6 rounded-2xl max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500">Nama Lengkap</label>
            <input
              className="input input-bordered w-full"
              placeholder="Contoh: Ahmad Pratama"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Kelas</label>
            <input
              className="input input-bordered w-full"
              placeholder="Contoh: X IPA 1"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Kode Ujian</label>
            <input
              className="input input-bordered w-full uppercase"
              placeholder="Contoh: A1B2C3"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <button
            className="btn btn-primary w-full"
            disabled={loading || !name.trim() || !className.trim() || !code.trim()}
            onClick={handleSubmit}
          >
            {loading ? 'Memproses...' : 'Mulai Ujian'}
          </button>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
