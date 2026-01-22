import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuthStore } from '../store';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<'admin' | 'teacher' | 'student'>('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: any }>(
        isRegister ? '/auth/register' : '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username, password, role })
        }
      );
      setAuth(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md shadow-lg">
        <h1 className="text-2xl font-bold text-neutral mb-2">Selamat datang</h1>
        <p className="text-sm text-slate-500 mb-6">
          {isRegister
            ? 'Buat akun pertama untuk mengelola ujian.'
            : 'Masuk untuk melanjutkan ke dashboard.'}
        </p>
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="label">Username</label>
            <input
              className="input input-bordered w-full"
              type="text"
              placeholder="Masukkan username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input input-bordered w-full"
              type="password"
              placeholder="Masukkan password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {isRegister && (
            <div>
              <label className="label">Role</label>
              <select
                className="select select-bordered w-full"
                value={role}
                onChange={(event) => setRole(event.target.value as any)}
              >
                <option value="admin">Admin</option>
                <option value="teacher">Guru</option>
                <option value="student">Siswa</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Admin hanya dibuat saat setup awal.
              </p>
            </div>
          )}
          <button className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Memproses...' : isRegister ? 'Daftar' : 'Login'}
          </button>
        </form>
        <button
          className="btn btn-link btn-sm mt-4"
          onClick={() => setIsRegister((value) => !value)}
        >
          {isRegister ? 'Sudah punya akun? Login' : 'First time? Buat akun admin'}
        </button>
      </div>
    </div>
  );
}
