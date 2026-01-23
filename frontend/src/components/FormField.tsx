type Props = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
};

export default function FormField({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  required = false,
  className
}: Props) {
  return (
    <div className={className}>
      <label className="text-xs text-slate-500 block mb-1">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      <input
        className="input input-bordered w-full"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  );
}
