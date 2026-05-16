import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-ip-card bg-slate-100 text-ip-accent ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
        {icon}
      </div>
      <h3 className="text-ip-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-xs text-ip-sm text-slate-500 dark:text-white/40">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 rounded-ip-pill bg-ip-accent px-5 py-2 text-ip-sm font-semibold text-white transition duration-ip-base ease-ip-base hover:bg-ip-accent-hover focus:outline-none"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
