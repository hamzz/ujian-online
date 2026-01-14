import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiBaseUrl, apiFetch } from "../api";

type Question = {
  id: string;
  type: string;
  content: string;
  options: string[] | null;
  weight: number;
  metadata?: any;
};

type SessionData = {
  sessionId: string;
  exam: {
    title: string;
    instructions: string;
    duration_minutes: number;
    settings: Record<string, any>;
  };
  questions: Question[];
  startTimestamp: number;
};

export default function ExamSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    if (!sessionId) return;
    const raw = sessionStorage.getItem(`session_${sessionId}`);
    if (!raw) return;
    setSession(JSON.parse(raw));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      apiFetch(`/student/sessions/${sessionId}/log`, {
        method: "POST",
        body: JSON.stringify({ event: "autosave_tick" })
      }).catch(() => undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let mounted = true;

    async function log(event: string, detail?: string) {
      try {
        await apiFetch(`/student/sessions/${sessionId}/log`, {
          method: "POST",
          body: JSON.stringify({ event, detail })
        });
      } catch {
        if (!mounted) return;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        setWarnings((prev) => prev + 1);
        log("tab_hidden", "User left the tab");
      }
    }

    function handleBlur() {
      setWarnings((prev) => prev + 1);
      log("window_blur", "Window lost focus");
    }

    function handleFullscreenChange() {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        log("fullscreen_exit", "Exited fullscreen mode");
      }
    }

    function blockEvent(e: Event) {
      e.preventDefault();
      log("blocked_action", e.type);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("copy", blockEvent);
    document.addEventListener("paste", blockEvent);

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("copy", blockEvent);
      document.removeEventListener("paste", blockEvent);
    };
  }, [sessionId]);

  const remainingMs = useMemo(() => {
    if (!session) return 0;
    const total = session.exam.duration_minutes * 60 * 1000;
    const elapsed = now - session.startTimestamp;
    return Math.max(total - elapsed, 0);
  }, [session, now]);

  useEffect(() => {
    if (!session || remainingMs > 0) return;
    handleFinish();
  }, [remainingMs, session]);

  useEffect(() => {
    if (!session) return;
    if (warnings >= 3 && session.exam.settings?.autoSubmitOnCheat) {
      handleFinish();
    }
  }, [warnings, session]);

  function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  async function saveAnswer(questionId: string, response: any) {
    if (!sessionId) return;
    setSaving(true);
    try {
      await apiFetch(`/student/sessions/${sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify({ questionId, response })
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    if (!sessionId) return;
    const result = await apiFetch(`/student/sessions/${sessionId}/finish`, { method: "POST" });
    navigate(`/exam/result/${sessionId}`, { state: result });
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Session tidak ditemukan.</p>
      </div>
    );
  }

  const question = session.questions[current];
  const timeWarning = remainingMs < 10 * 60 * 1000;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">{session.exam.title}</h1>
            <p className="text-sm text-slate-500">{session.exam.instructions}</p>
          </div>
          <div className={`rounded-lg px-4 py-2 font-semibold ${timeWarning ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700"}`}>
            {formatTime(remainingMs)}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="bg-white rounded-2xl shadow p-6">
          {warnings >= 3 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              Peringatan: terdeteksi pindah tab beberapa kali. Mohon fokus pada ujian.
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Soal {current + 1}</h2>
            <button
              className={`text-sm ${marked[question.id] ? "text-amber-600" : "text-slate-500"}`}
              onClick={() => setMarked((prev) => ({ ...prev, [question.id]: !prev[question.id] }))}
            >
              {marked[question.id] ? "Tandai dihapus" : "Tandai review"}
            </button>
          </div>
          <p className="mt-4 text-slate-800 whitespace-pre-wrap">{question.content}</p>
          {Array.isArray(question.metadata?.images) && question.metadata.images.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {question.metadata.images.slice(0, 3).map((url: string) => {
                const src = url.startsWith("http") ? url : `${apiBaseUrl}${url}`;
                return (
                <div
                  key={url}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50 p-2"
                >
                  <img
                    src={src}
                    alt="Ilustrasi soal"
                    className="h-48 w-full object-contain cursor-zoom-in"
                    loading="lazy"
                    onClick={() => {
                      setZoomScale(1);
                      setZoomImage(src);
                    }}
                  />
                </div>
                );
              })}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {question.type === "multiple_choice" &&
              question.options?.map((opt) => (
                <label key={opt} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={question.id}
                    checked={answers[question.id] === opt}
                    onChange={() => {
                      setAnswers((prev) => ({ ...prev, [question.id]: opt }));
                      saveAnswer(question.id, opt);
                    }}
                  />
                  <span>{opt}</span>
                </label>
              ))}

            {question.type === "multiple_select" &&
              question.options?.map((opt) => {
                const currentList: string[] = answers[question.id] || [];
                const checked = currentList.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? currentList.filter((item) => item !== opt)
                          : [...currentList, opt];
                        setAnswers((prev) => ({ ...prev, [question.id]: next }));
                        saveAnswer(question.id, next);
                      }}
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}

            {question.type === "true_false" && (
              <div className="space-x-4">
                {[true, false].map((value) => (
                  <label key={String(value)} className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name={`${question.id}-tf`}
                      checked={answers[question.id] === value}
                      onChange={() => {
                        setAnswers((prev) => ({ ...prev, [question.id]: value }));
                        saveAnswer(question.id, value);
                      }}
                    />
                    <span>{value ? "Benar" : "Salah"}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === "short_answer" && (
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={answers[question.id] || ""}
                onChange={(e) => {
                  setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }));
                }}
                onBlur={(e) => saveAnswer(question.id, e.target.value)}
              />
            )}

            {question.type === "essay" && (
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[140px]"
                value={answers[question.id] || ""}
                onChange={(e) => {
                  setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }));
                }}
                onBlur={(e) => saveAnswer(question.id, e.target.value)}
              />
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-2xl shadow p-4 space-y-2">
            <div className="text-sm text-slate-500">Kepatuhan Ujian</div>
            <div className="text-sm">Peringatan: {warnings}</div>
            <button
              className="w-full rounded-lg border border-slate-200 py-2 text-sm"
              onClick={async () => {
                if (!document.fullscreenElement) {
                  await document.documentElement.requestFullscreen().catch(() => undefined);
                }
              }}
            >
              {isFullscreen ? "Fullscreen aktif" : "Masuk Fullscreen"}
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Navigasi</h3>
              <span className="text-xs text-slate-500">{saving ? "Menyimpan..." : "Tersimpan"}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {session.questions.map((q, index) => {
                const answered = answers[q.id] !== undefined;
                const isMarked = marked[q.id];
                return (
                  <button
                    key={q.id}
                    className={`rounded-md px-2 py-1 text-xs font-medium border ${
                      index === current
                        ? "border-brand-500 bg-brand-50"
                        : answered
                        ? "border-emerald-400 bg-emerald-50"
                        : isMarked
                        ? "border-amber-400 bg-amber-50"
                        : "border-slate-200"
                    }`}
                    onClick={() => setCurrent(index)}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <button
              className="w-full rounded-lg border border-slate-200 py-2"
              onClick={() => setCurrent((prev) => Math.max(prev - 1, 0))}
              disabled={current === 0}
            >
              Sebelumnya
            </button>
            <button
              className="w-full rounded-lg border border-slate-200 py-2"
              onClick={() => setCurrent((prev) => Math.min(prev + 1, session.questions.length - 1))}
              disabled={current === session.questions.length - 1}
            >
              Berikutnya
            </button>
            <button
              className="w-full rounded-lg bg-brand-500 text-white py-2 font-medium hover:bg-brand-700"
              onClick={handleFinish}
            >
              Submit Ujian
            </button>
          </div>
        </aside>
      </main>

      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-white rounded-2xl shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-700">Zoom Gambar</div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                  onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.25))}
                >
                  -
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                  onClick={() => setZoomScale(1)}
                >
                  Reset
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                  onClick={() => setZoomScale((prev) => Math.min(3, prev + 0.25))}
                >
                  +
                </button>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
                  onClick={() => setZoomImage(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[70vh] flex items-center justify-center">
              <img
                src={zoomImage}
                alt="Zoom"
                style={{ transform: `scale(${zoomScale})` }}
                className="transition-transform origin-center max-w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
