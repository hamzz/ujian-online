import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import FormField from '../components/FormField';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { startPublicExam } from '../services/publicExams';

export default function JoinExam() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [code, setCode] = useState('');
  const { run, loading, error, resetError } = useAsyncAction(startPublicExam);

  const canSubmit = useMemo(
    () => Boolean(name.trim() && className.trim() && code.trim()),
    [name, className, code]
  );

  const handleSubmit = async () => {
    const payload = {
      name: name.trim(),
      class_name: className.trim(),
      exam_key: code.trim().toUpperCase()
    };
    const data = await run(payload);
    navigate(`/public/sessions/${data.session_id}`);
  };

  return (
    <div>
      <PageHeader
        title="Masuk Ujian"
        subtitle="Masukkan nama, kelas, dan kode ujian dari guru."
      />
      <div className="glass-panel p-6 rounded-2xl max-w-xl">
        <div className="space-y-4">
          <FormField
            label="Nama Lengkap"
            placeholder="Contoh: Ahmad Pratama"
            value={name}
            onChange={(val) => {
              resetError();
              setName(val);
            }}
            required
          />
          <FormField
            label="Kelas"
            placeholder="Contoh: X IPA 1"
            value={className}
            onChange={(val) => {
              resetError();
              setClassName(val);
            }}
            required
          />
          <FormField
            label="Kode Ujian"
            placeholder="Contoh: A1B2C3"
            value={code}
            onChange={(val) => {
              resetError();
              setCode(val.toUpperCase());
            }}
            required
          />
          <button
            className="btn btn-primary w-full"
            disabled={loading || !canSubmit}
            onClick={() => handleSubmit().catch(() => {})}
          >
            {loading ? 'Memproses...' : 'Mulai Ujian'}
          </button>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      </div>
    </div>
  );
}
