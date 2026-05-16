import { useState, useEffect, useRef } from 'react';
import type { LeadDetailPanelProps } from '@/types/leads';

export default function LeadDetailPanel({ lead, isSaving, saveError, onSave }: LeadDetailPanelProps): JSX.Element {
  const [note, setNote] = useState(lead.internalNote);
  const [actionDate, setActionDate] = useState(
    lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : ''
  );
  const [actionText, setActionText] = useState(lead.nextActionText);
  const isDirty =
    note !== lead.internalNote ||
    (actionDate ? `${actionDate}T00:00:00.000Z` : null) !== lead.nextActionAt ||
    actionText !== lead.nextActionText;

  // Keep local state in sync if parent lead changes (e.g., after save)
  const prevLeadRef = useRef(lead.id);
  useEffect(() => {
    if (prevLeadRef.current !== lead.id) {
      setNote(lead.internalNote);
      setActionDate(lead.nextActionAt ? lead.nextActionAt.slice(0, 10) : '');
      setActionText(lead.nextActionText);
      prevLeadRef.current = lead.id;
    }
  }, [lead.id, lead.internalNote, lead.nextActionAt, lead.nextActionText]);

  function handleSave(): void {
    onSave({
      internalNote: note,
      nextActionAt: actionDate ? new Date(actionDate).toISOString() : null,
      nextActionText: actionText,
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Nota interna del agente */}
      <div>
        <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
          Nota interna (solo visible para el agente)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Ej: Muy interesado, llamar el lunes por la mañana…"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        />
      </div>

      {/* Próxima acción */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            Próxima acción — fecha
          </label>
          <input
            type="date"
            value={actionDate}
            onChange={(e) => setActionDate(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            Próxima acción — descripción
          </label>
          <input
            type="text"
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="Ej: Llamar, enviar ficha, agendar visita…"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>
      </div>

      {/* Footer: save + error */}
      <div className="md:col-span-2 flex items-center justify-between gap-4">
        {saveError ? (
          <p className="text-xs font-semibold text-red-600">{saveError}</p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !isDirty}
          className="flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Guardando…
            </>
          ) : (
            'Guardar cambios'
          )}
        </button>
      </div>
    </div>
  );
}
