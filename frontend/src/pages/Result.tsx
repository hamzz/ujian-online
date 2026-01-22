import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { apiFetch } from "../api";

export default function ResultPage() {
  const { sessionId } = useParams();
  const location = useLocation();
  const [result, setResult] = useState<any>(location.state || null);

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      const data = await apiFetch(`/student/sessions/${sessionId}/result`);
      setResult(data);
    }
    if (!result) load();
  }, [result, sessionId]);

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Memuat hasil...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card rounded-3xl p-10 w-full max-w-md text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-700 text-xl">
          ✓
        </div>
        <h2 className="text-xl font-semibold">Hasil Ujian</h2>
        <p className="text-slate-600 mt-2">Skor akhir kamu:</p>
        <div className="mt-4 text-5xl font-bold text-brand-600">{result.totalScore}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-700">Grade {result.gradeLetter}</div>
        <Link to="/" className="mt-6 inline-flex btn-primary rounded-xl px-4 py-2 font-medium">
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
