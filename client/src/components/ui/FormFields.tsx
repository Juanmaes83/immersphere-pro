export function FormInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}): JSX.Element {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <input type={type} required value={value} onChange={(event) => onChange(event.target.value)} className="brand-focus w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none" />
    </label>
  );
}

export function FormTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="brand-focus w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none" />
    </label>
  );
}
