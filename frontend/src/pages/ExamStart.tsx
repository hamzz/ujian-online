import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";

export default function ExamStartPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreeIntegrity, setAgreeIntegrity] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const exam = await apiFetch<any>(`/student/exams/code/${code}`);
      const session = await apiFetch<any>(`/student/exams/${exam.id}/start`, { method: "POST" });
      const startTimestamp = Date.now();
      sessionStorage.setItem(
        `session_${session.sessionId}`,
        JSON.stringify({ ...session, startTimestamp })
      );
      navigate(`/exam/session/${session.sessionId}`);
    } catch (err: any) {
      setError(err.message || "Kode tidak valid");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-lg bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-semibold">Mulai Ujian</h2>
        <p className="text-sm text-slate-600 mt-2">Masukkan kode ujian yang diberikan guru.</p>
        <form onSubmit={handleStart} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 uppercase tracking-widest"
            placeholder="KODEUJIAN"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <div className="space-y-2 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={agreeIntegrity}
                onChange={(e) => setAgreeIntegrity(e.target.checked)}
              />
              Saya menyetujui pernyataan integritas ujian.
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={deviceReady}
                onChange={(e) => setDeviceReady(e.target.checked)}
              />
              Perangkat dan jaringan saya siap digunakan.
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium hover:bg-brand-700"
            type="submit"
            disabled={loading || !agreeIntegrity || !deviceReady}
          >
            {loading ? "Menyiapkan..." : "Mulai"}
          </button>
        </form>
      </div>
    </div>
  );
}
