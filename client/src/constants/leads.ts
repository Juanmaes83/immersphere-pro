export const LEAD_STATUSES = ['nuevo', 'contactado', 'visita', 'negociando', 'cerrado', 'descartado'] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_META: Record<LeadStatus, { label: string; bg: string; text: string }> = {
  nuevo:       { label: 'Nuevo',       bg: 'bg-slate-100',   text: 'text-slate-600'  },
  contactado:  { label: 'Contactado',  bg: 'bg-blue-50',     text: 'text-blue-700'   },
  visita:      { label: 'Visita',      bg: 'bg-violet-50',   text: 'text-violet-700' },
  negociando:  { label: 'Negociando',  bg: 'bg-amber-50',    text: 'text-amber-700'  },
  cerrado:     { label: 'Cerrado',     bg: 'bg-emerald-50',  text: 'text-emerald-700'},
  descartado:  { label: 'Descartado',  bg: 'bg-red-50',      text: 'text-red-600'    },
};

export const DONE_STATUSES = new Set<string>(['cerrado', 'descartado']);
