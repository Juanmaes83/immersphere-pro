export function CommercialCard({
  label,
  value,
  sub,
  accent,
  dim,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  dim?: boolean;
  loading?: boolean;
}): JSX.Element {
  return (
    <article className="rounded-ip-card bg-white px-5 py-5 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
      <p className="text-ip-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-white/35">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-10 animate-pulse rounded-lg bg-slate-200 dark:bg-white/5" />
      ) : (
        <p className={`mt-3 text-ip-2xl font-bold tracking-tight ${
          dim ? 'text-slate-300 dark:text-white/20' : accent ? 'text-ip-warning' : 'text-slate-900 dark:text-white'
        }`}>
          {value}
        </p>
      )}
      {sub ? (
        <p className={`mt-1 text-ip-xs ${dim ? 'text-slate-300 dark:text-white/20' : 'text-slate-500 dark:text-white/30'}`}>{sub}</p>
      ) : null}
    </article>
  );
}
