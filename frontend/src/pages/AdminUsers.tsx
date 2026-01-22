import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

type User = {
  id: string;
  username: string;
  email?: string | null;
  role: 'admin' | 'teacher' | 'student';
  created_at: string;
};

type UserResponse = {
  total: number;
  page: number;
  page_size: number;
  data: User[];
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', role: 'teacher' });
  const [importMessage, setImportMessage] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<UserResponse>(`/admin/users?page=${page}&page_size=${pageSize}`);
      setUsers(data.data);
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

  const handleCreate = async () => {
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ username: '', password: '', role: 'teacher' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTemplateDownload = (type: 'csv' | 'xlsx') => {
    const rows = [
      ['username', 'password', 'role', 'name', 'nis', 'class', 'email'],
      ['siswa1', 'Siswa123!', 'student', 'Siswa Satu', '12345', 'X IPA 1', ''],
      ['guru1', 'Guru123!', 'teacher', 'Guru Satu', '', '', '']
    ];
    if (type === 'csv') {
      const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template-user.csv';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'template-user.xlsx');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportMessage('');
    try {
      let csvText = '';
      if (file.name.endsWith('.csv')) {
        csvText = await file.text();
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        csvText = XLSX.utils.sheet_to_csv(sheet);
      }
      const result = await apiFetch<{ inserted: number; skipped: number }>('/admin/import/users', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText })
      });
      setImportMessage(
        `Import selesai. Berhasil: ${result.inserted}, dilewati: ${result.skipped}.`
      );
      await load();
    } catch (err: any) {
      setImportMessage(err.message);
    } finally {
      event.target.value = '';
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <PageHeader
        title="Manajemen User"
        subtitle="Buat akun admin/guru/siswa dan kelola akses."
      />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Tambah User</h3>
          <div className="space-y-3">
            <label className="text-xs text-slate-500">Username</label>
            <input
              className="input input-bordered w-full"
              placeholder="Username"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
            <label className="text-xs text-slate-500">Password</label>
            <input
              className="input input-bordered w-full"
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <label className="text-xs text-slate-500">Role</label>
            <select
              className="select select-bordered w-full"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value })}
            >
              <option value="admin">Admin</option>
              <option value="teacher">Guru</option>
              <option value="student">Siswa</option>
            </select>
            <button className="btn btn-primary w-full" onClick={handleCreate}>
              Simpan
            </button>
            {error && <p className="text-sm text-error">{error}</p>}
          </div>
          <div className="divider"></div>
          <h4 className="font-semibold mb-2">Import Bulk (CSV/XLSX)</h4>
          <p className="text-xs text-slate-500 mb-2">
            Kolom wajib: username, password. Role: admin/teacher/student.
          </p>
          <label className="text-xs text-slate-500">Upload File</label>
          <input
            className="file-input file-input-bordered w-full"
            type="file"
            accept=".csv,.xlsx"
            onChange={handleImportFile}
          />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-outline btn-xs" onClick={() => handleTemplateDownload('csv')}>
              Download CSV
            </button>
            <button className="btn btn-outline btn-xs" onClick={() => handleTemplateDownload('xlsx')}>
              Download XLSX
            </button>
          </div>
          {importMessage && <p className="text-xs text-slate-500 mt-2">{importMessage}</p>}
        </div>
        <div className="md:col-span-2 glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Daftar User</h3>
          {loading ? (
            <Loading />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Dibuat</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td className="uppercase text-xs font-semibold">{user.role}</td>
                      <td>{new Date(user.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-slate-500">Total {total} user</span>
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
      </div>
    </div>
  );
}
