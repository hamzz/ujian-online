export default function Loading({ label = 'Memuat...' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
      <span className="loading loading-spinner loading-sm"></span>
      <span>{label}</span>
    </div>
  );
}
