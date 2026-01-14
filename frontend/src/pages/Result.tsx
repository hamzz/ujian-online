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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Memuat hasil...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md text-center">
        <h2 className="text-xl font-semibold">Hasil Ujian</h2>
        <p className="text-slate-600 mt-2">Skor akhir kamu:</p>
        <div className="mt-4 text-5xl font-bold text-brand-600">{result.totalScore}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-700">Grade {result.gradeLetter}</div>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-lg bg-brand-500 text-white px-4 py-2 font-medium hover:bg-brand-700"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  );
}
