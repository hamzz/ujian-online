import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Loading from '../components/Loading';
import { apiFetch } from '../api';

const tick = 1000;

type Question = {
  id: string;
  content: string;
  type: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay';
  options?: string[];
  image_urls?: string[];
};

type ExamPayload = {
  session: { id: string; start_time: string; status: string };
  exam: { id: string; title: string; instructions: string; duration_minutes: number; settings: any };
  questions: Question[];
};

export default function TakeExam() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<ExamPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<number | null>(null);
  const [checklist, setChecklist] = useState({
    integrity: false,
    device: false,
    identity: false
  });
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<ExamPayload>(`/student/sessions/${sessionId}`);
        setPayload(data);
        const duration = data.exam.duration_minutes * 60 * 1000;
        setRemaining(duration);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    if (!payload) return;

    const interval = window.setInterval(() => {
      if (!acceptedAt) return;
      const duration = payload.exam.duration_minutes * 60 * 1000;
      const next = Math.max(0, acceptedAt + duration - Date.now());
      setRemaining(next);
      if (next === 0 && payload.exam.settings?.autoSubmit) {
        handleSubmit();
      }
    }, tick);

    return () => window.clearInterval(interval);
  }, [payload, acceptedAt]);

  useEffect(() => {
    if (!payload) return;
    const onBlur = () => {
      setWarnings((count) => count + 1);
      sendLog('tab-blur');
    };
    const onFocus = () => sendLog('tab-focus');
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    const preventContext = (event: MouseEvent) => {
      if (payload.exam.settings?.antiCheat?.blockCopy) {
        event.preventDefault();
      }
    };
    document.addEventListener('contextmenu', preventContext);

    const preventCopy = (event: ClipboardEvent) => {
      if (payload.exam.settings?.antiCheat?.blockCopy) {
        event.preventDefault();
      }
    };
    document.addEventListener('copy', preventCopy);
    document.addEventListener('paste', preventCopy);

    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('contextmenu', preventContext);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('paste', preventCopy);
    };
  }, [payload]);

  useEffect(() => {
    if (!payload || !sessionId) return;
    const heartbeat = window.setInterval(() => {
      apiFetch(`/student/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
        body: JSON.stringify({
          status: navigator.onLine ? 'online' : 'offline'
        })
      }).catch(() => null);
    }, 30000);

    const handleOnline = () => sendLog('network-online');
    const handleOffline = () => sendLog('network-offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [payload, sessionId]);

  useEffect(() => {
    if (!payload) return;
    if (warnings >= 3 && payload.exam.settings?.antiCheat?.autoSubmitOnCheat) {
      handleSubmit();
    }
  }, [warnings, payload]);

  const sendLog = async (event: string, detail?: Record<string, unknown>) => {
    if (!sessionId) return;
    await apiFetch(`/student/sessions/${sessionId}/logs`, {
      method: 'POST',
      body: JSON.stringify({ event, detail })
    }).catch(() => null);
  };

  const handleAnswer = async (questionId: string, response: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    if (!sessionId) return;
    await apiFetch(`/student/sessions/${sessionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, response })
    });
  };

  const handleSubmit = async () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      await apiFetch(`/student/sessions/${sessionId}/submit`, { method: 'POST' });
      navigate(`/student/sessions/${sessionId}/results`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formattedRemaining = useMemo(() => {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [remaining]);

  if (loading) return <Loading />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!payload) return null;

  const question = payload.questions[currentIndex];
  const requestFullscreen = async () => {
    if (document.fullscreenElement) return;
    await document.documentElement.requestFullscreen().catch(() => null);
  };
  const readyToStart = checklist.integrity && checklist.device && checklist.identity;

  return (
    <div>
      {!accepted && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl max-w-lg w-full">
            <h2 className="text-xl font-semibold mb-2">Checklist Sebelum Ujian</h2>
            <p className="text-sm text-slate-500 mb-4">
              Konfirmasi kesiapan perangkat dan komitmen kejujuran sebelum memulai ujian.
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={checklist.integrity}
                  onChange={(event) =>
                    setChecklist({ ...checklist, integrity: event.target.checked })
                  }
                />
                <span>Saya mengerjakan ujian secara jujur.</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={checklist.device}
                  onChange={(event) =>
                    setChecklist({ ...checklist, device: event.target.checked })
                  }
                />
                <span>Perangkat dan koneksi siap digunakan.</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={checklist.identity}
                  onChange={(event) =>
                    setChecklist({ ...checklist, identity: event.target.checked })
                  }
                />
                <span>Saya adalah peserta ujian yang terdaftar.</span>
              </label>
            </div>
            <button
              className="btn btn-primary w-full mt-4"
              disabled={!readyToStart}
              onClick={() => {
                setAccepted(true);
                setAcceptedAt(Date.now());
                if (payload) {
                  setRemaining(payload.exam.duration_minutes * 60 * 1000);
                }
                sendLog('checklist-accepted');
              }}
            >
              Mulai Ujian
            </button>
          </div>
        </div>
      )}
      <PageHeader
        title={payload.exam.title}
        subtitle={payload.exam.instructions}
        action={
          <div className="flex items-center gap-3">
            <span
              className={`badge badge-lg ${
                remaining < 10 * 60 * 1000 ? 'badge-warning' : 'badge-primary'
              }`}
            >   
              {formattedRemaining}
            </span>
            {payload.exam.settings?.antiCheat?.fullscreen && (
              <button className="btn btn-outline btn-sm" onClick={requestFullscreen}>
                Fullscreen
              </button>
            )}
            <button className="btn btn-outline" onClick={handleSubmit} disabled={submitting}>
              Submit
            </button>
          </div>
        }
      />
      {warnings >= 3 && (
        <div className="alert alert-warning mb-4">
          Anda meninggalkan tab sebanyak {warnings} kali.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr,260px]">
        <div className="glass-panel p-6 rounded-2xl">
          {!question ? (
            <div className="text-sm text-slate-500">
              Soal belum tersedia untuk ujian ini.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Soal {currentIndex + 1}</h2>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                >
                  Prev
                </button>
              </div>
              <p className="text-lg font-medium">{question.content}</p>
              {question.image_urls && question.image_urls.length > 0 && (
                <div className="flex gap-3 mt-4 flex-wrap">
                  {question.image_urls.map((url) => (
                    <button
                      key={url}
                      className="border border-slate-200 rounded-lg overflow-hidden"
                      onClick={() => setZoomImage(url)}
                    >
                      <img src={url} alt="Soal" className="w-28 h-20 object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 space-y-2">
                {question.type === 'multiple_choice' &&
                  question.options?.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`q-${question.id}`}
                        className="radio radio-primary"
                        checked={answers[question.id] === option}
                        onChange={() => handleAnswer(question.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                {question.type === 'multiple_select' &&
                  question.options?.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={(answers[question.id] ?? []).includes(option)}
                        onChange={() => {
                          const current = answers[question.id] ?? [];
                          const next = current.includes(option)
                            ? current.filter((item: string) => item !== option)
                            : [...current, option];
                          handleAnswer(question.id, next);
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                {question.type === 'true_false' && (
                  <div className="flex gap-4">
                    {[true, false].map((value) => (
                      <label key={String(value)} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`q-${question.id}`}
                          className="radio radio-primary"
                          checked={answers[question.id] === value}
                          onChange={() => handleAnswer(question.id, value)}
                        />
                        <span>{value ? 'Benar' : 'Salah'}</span>
                      </label>
                    ))}
                  </div>
                )}
                {question.type === 'short_answer' && (
                  <input
                    className="input input-bordered w-full"
                    value={answers[question.id] ?? ''}
                    onChange={(event) => handleAnswer(question.id, event.target.value)}
                  />
                )}
                {question.type === 'essay' && (
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={6}
                    value={answers[question.id] ?? ''}
                    onChange={(event) => handleAnswer(question.id, event.target.value)}
                  />
                )}
              </div>
              <div className="flex justify-between mt-6">
                <button
                  className="btn btn-outline"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                >
                  Sebelumnya
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    setCurrentIndex((index) =>
                      Math.min(payload.questions.length - 1, index + 1)
                    )
                  }
                  disabled={currentIndex === payload.questions.length - 1}
                >
                  Berikutnya
                </button>
              </div>
            </>
          )}
        </div>
        <div className="glass-panel p-5 rounded-2xl">
          <h3 className="font-semibold mb-3">Navigasi Soal</h3>
          <div className="grid grid-cols-5 gap-2">
            {payload.questions.map((item, index) => {
              const answered = answers[item.id] !== undefined;
              return (
                <button
                  key={item.id}
                  className={`btn btn-xs ${answered ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCurrentIndex(index)}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-slate-500">
            Jawaban tersimpan otomatis setiap perubahan.
          </div>
        </div>
      </div>
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-6"
          onClick={() => setZoomImage(null)}
        >
          <div className="bg-white rounded-2xl p-4 max-w-3xl w-full">
            <img src={zoomImage} alt="Zoom" className="w-full h-auto rounded-xl" />
            <button className="btn btn-sm btn-outline mt-3" onClick={() => setZoomImage(null)}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
