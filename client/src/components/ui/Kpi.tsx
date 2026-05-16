export function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <article className="rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950 dark:text-slate-100">{value}</p>
    </article>
  );
}
