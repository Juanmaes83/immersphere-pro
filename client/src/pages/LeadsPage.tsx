import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';
import { markLeadsAsSeen } from '@/hooks/useLeadsBadge';
import { api, unwrapApiResponse, getApiErrorMessage } from '@/services/api';
import type { LeadWithProperty } from '@/types/leads';
import { LEAD_STATUSES, type LeadStatus, STATUS_META, DONE_STATUSES } from '@/constants/leads';
import { EmptyState } from '@/components/ui/EmptyState';
import { IcoInbox, IcoSearchX, IcoCheckCircle } from '@/components/ui/icons';
import LeadDetailPanel from '@/components/leads/LeadDetailPanel';

export default function LeadsPage(): JSX.Element {
  const { bgStyle, color: brandColor } = useBrand();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<LeadWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Server-side filters (sent to API)
  // Seed filterProperty from ?propertyId= URL param (set by property quick actions)
  const [filterProperty, setFilterProperty] = useState<string>(() => searchParams.get('propertyId') ?? '');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Client-side filters (instant, no API call)
  const [filterSearch, setFilterSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Inline editing state
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'email' | 'link' | null>(null);

  const hasActiveFilters = filterProperty || filterFrom || filterTo || filterSearch || filterSource || filterStatus;

  useEffect(() => {
    api.get('/leads/count')
      .then((res) => {
        const count = (res.data as { data: { count: number } }).data?.count ?? 0;
        markLeadsAsSeen(count);
      })
      .catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterProperty) params.set('propertyId', filterProperty);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const qs = params.toString();
      const data = await unwrapApiResponse<LeadWithProperty[]>(
        api.get(`/leads${qs ? `?${qs}` : ''}`)
      );
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filterProperty, filterFrom, filterTo]);

  useEffect(() => { void fetchLeads(); }, [fetchLeads]);

  async function handleExportCsv(): Promise<void> {
    if (exporting) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filterProperty) params.set('propertyId', filterProperty);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      const qs = params.toString();
      const response = await api.get(`/leads/export.csv${qs ? `?${qs}` : ''}`, { responseType: 'text' });
      const blob = new Blob([response.data as string], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }

  function handleClearFilters(): void {
    setFilterProperty('');
    setFilterFrom('');
    setFilterTo('');
    setFilterSearch('');
    setFilterSource('');
    setFilterStatus('');
  }

  async function handleUpdateLead(
    leadId: string,
    patch: Partial<Pick<LeadWithProperty, 'status' | 'internalNote' | 'nextActionAt' | 'nextActionText'>>
  ): Promise<void> {
    setSavingLeadId(leadId);
    setSaveError(null);
    try {
      await api.patch(`/leads/${leadId}`, patch);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, ...patch, updatedAt: new Date().toISOString() }
            : l
        )
      );
    } catch (err) {
      setSaveError(getApiErrorMessage(err));
    } finally {
      setSavingLeadId(null);
    }
  }

  function handleStatusChange(leadId: string, newStatus: string): void {
    void handleUpdateLead(leadId, { status: newStatus });
  }

  function cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  async function handleCopy(id: string, type: 'email' | 'link', text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setCopiedType(type);
      setTimeout(() => { setCopiedId(null); setCopiedType(null); }, 1800);
    } catch { /* clipboard unavailable */ }
  }

  const uniqueProperties = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of leads) map.set(l.propertyId, l.propertyTitle || l.propertyId.slice(0, 8));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [leads]);

  const uniqueSources = useMemo(() => [...new Set(leads.map((l) => l.source).filter(Boolean))].sort(), [leads]);

  const filtered = useMemo(() => {
    const q = filterSearch.toLowerCase().trim();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const isOverdue = (l: LeadWithProperty) =>
      !!l.nextActionAt && new Date(l.nextActionAt) <= todayEnd && !DONE_STATUSES.has(l.status);

    return leads
      .filter((l) => {
        if (filterSource && l.source !== filterSource) return false;
        if (filterStatus && l.status !== filterStatus) return false;
        if (q) {
          const hit =
            l.email.toLowerCase().includes(q) ||
            (l.phone || '').toLowerCase().includes(q) ||
            (l.propertyTitle || '').toLowerCase().includes(q) ||
            (l.notes || '').toLowerCase().includes(q) ||
            (l.internalNote || '').toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aOver = isOverdue(a);
        const bOver = isOverdue(b);
        // Overdue first
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        // Both have nextActionAt — sort ascending (soonest first)
        if (a.nextActionAt && b.nextActionAt)
          return new Date(a.nextActionAt).getTime() - new Date(b.nextActionAt).getTime();
        // One has nextActionAt, the other doesn't
        if (a.nextActionAt && !b.nextActionAt) return -1;
        if (!a.nextActionAt && b.nextActionAt) return 1;
        // Neither has nextActionAt — newest first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [leads, filterSource, filterStatus, filterSearch]);

  // ── Metrics + pending today ───────────────────────────────────────
  const metrics = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const thisWeek = leads.filter((l) => new Date(l.createdAt) >= weekAgo).length;

    const pendingToday = leads.filter(
      (l) => l.nextActionAt && new Date(l.nextActionAt) <= todayEnd && !DONE_STATUSES.has(l.status)
    ).length;

    const byProperty = new Map<string, { title: string; count: number }>();
    for (const l of leads) {
      const entry = byProperty.get(l.propertyId) ?? { title: l.propertyTitle || l.propertyId.slice(0, 8), count: 0 };
      entry.count += 1;
      byProperty.set(l.propertyId, entry);
    }
    const topProperty = [...byProperty.values()].sort((a, b) => b.count - a.count)[0] ?? null;

    const bySource = new Map<string, number>();
    for (const l of leads) {
      bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
    }
    const topSource = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    return { total: leads.length, thisWeek, pendingToday, topProperty, topSource };
  }, [leads]);

  // ── Pending-today list (sorted by urgency) ────────────────────────
  const pendingLeads = useMemo(() => {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return leads
      .filter((l) => l.nextActionAt && new Date(l.nextActionAt) <= todayEnd && !DONE_STATUSES.has(l.status))
      .sort((a, b) => new Date(a.nextActionAt!).getTime() - new Date(b.nextActionAt!).getTime());
  }, [leads]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Helmet>
        <title>Leads · Immersphere Pro</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* ── Premium Header ── */}
      <div className="mb-8 overflow-hidden rounded-3xl bg-slate-900 shadow-xl">
        <div className="relative flex flex-wrap items-center justify-between gap-4 px-8 py-8">
          {/* Background image */}
          <div className="pointer-events-none absolute inset-0">
            <img
              src="/images/leads-dashboard-premium.webp"
              alt=""
              className="h-full w-full object-cover object-right opacity-60"
              aria-hidden="true"
            />
            {/* Gradient covers left 55% to protect text, image visible on right */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 from-40% via-slate-900/80 to-transparent" />
          </div>
          {/* Left: title + metrics */}
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-400">CRM · Gestión de interesados</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight text-white">Leads</h1>
            <p className="mt-1.5 text-sm text-slate-400">{metrics.total} en total · {metrics.thisWeek} esta semana</p>
          </div>
          {/* Right: export */}
          <div className="relative">
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={exporting || leads.length === 0}
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
              title={filtered.length < leads.length ? `Exporta los ${filtered.length} leads con los filtros activos del servidor` : `Exporta todos los ${leads.length} leads`}
            >
              {exporting ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Exportando…
                </>
              ) : (
                <>↓ CSV ({leads.length})</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── B5: Stats row ── */}
      {!loading && leads.length > 0 ? (
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Total leads</p>
            <p className="mt-1 text-3xl font-black dark:text-white">{metrics.total}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Esta semana</p>
            <p className="mt-1 text-3xl font-black dark:text-white">{metrics.thisWeek}</p>
            <p className="mt-0.5 text-xs text-slate-400">últimos 7 días</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Propiedad top</p>
            {metrics.topProperty ? (
              <>
                <p className="mt-1 truncate text-base font-black leading-tight dark:text-white">{metrics.topProperty.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{metrics.topProperty.count} lead{metrics.topProperty.count !== 1 ? 's' : ''}</p>
              </>
            ) : (
              <p className="mt-1 text-slate-400">—</p>
            )}
          </div>
          <div className={`rounded-2xl p-4 ring-1 ${metrics.pendingToday > 0 ? 'bg-red-50 ring-red-200 dark:bg-red-900/20 dark:ring-red-800' : 'bg-white ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'}`}>
            <p className={`text-xs font-bold uppercase tracking-[0.14em] ${metrics.pendingToday > 0 ? 'text-red-400' : 'text-slate-400'}`}>Pendientes hoy</p>
            <p className={`mt-1 text-3xl font-black ${metrics.pendingToday > 0 ? 'text-red-600 dark:text-red-400' : 'dark:text-white'}`}>
              {metrics.pendingToday}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {metrics.pendingToday === 0 ? 'sin acciones pendientes' : metrics.pendingToday === 1 ? 'acción pendiente' : 'acciones pendientes'}
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Pendientes hoy ── */}
      {!loading && leads.length > 0 && pendingLeads.length === 0 ? (
        <div className="mb-5 flex items-center gap-4 rounded-ip-card bg-white px-5 py-4 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ip-success/10 text-ip-success">
            {IcoCheckCircle}
          </span>
          <div>
            <p className="text-ip-base font-semibold text-slate-900 dark:text-white">Todo al día</p>
            <p className="text-ip-sm text-slate-500 dark:text-white/40">No tienes acciones pendientes para hoy.</p>
          </div>
        </div>
      ) : null}
      {!loading && pendingLeads.length > 0 ? (
        <div className="mb-5 rounded-[1.5rem] border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-red-500">
            ⚠ Pendientes hoy — {pendingLeads.length} {pendingLeads.length === 1 ? 'lead requiere acción' : 'leads requieren acción'}
          </p>
          <div className="flex flex-col gap-2">
            {pendingLeads.map((l) => {
              const meta = STATUS_META[l.status as LeadStatus] ?? STATUS_META.nuevo;
              const actionDate = l.nextActionAt
                ? new Date(l.nextActionAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                : '';
              return (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-2.5 ring-1 ring-red-100 dark:bg-slate-800 dark:ring-red-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black dark:text-white">
                      {l.email}
                      <span className="ml-2 font-semibold text-slate-400">{l.propertyTitle}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-red-500 font-semibold">
                      {actionDate}{l.nextActionText ? ` · ${l.nextActionText}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedLeadId(l.id);
                      setTimeout(() => {
                        document.getElementById(`lead-row-${l.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 60);
                    }}
                    className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
                  >
                    Ver →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ── B1: Filters ── */}
      <div className="mb-5 rounded-[1.5rem] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex flex-wrap items-center gap-3">
          {/* Live search */}
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Buscar email, teléfono, propiedad…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-4 text-sm font-semibold outline-none focus:border-violet-400 focus:bg-white dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>

          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Todas las propiedades</option>
            {uniqueProperties.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Todos los estados</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="">Todos los orígenes</option>
            {uniqueSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            title="Desde"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            title="Hasta"
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              ✕ Limpiar
            </button>
          ) : null}
        </div>

        {/* Active filter summary */}
        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {filterSearch ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                🔍 "{filterSearch}"
              </span>
            ) : null}
            {filterProperty ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                🏠 {uniqueProperties.find(([id]) => id === filterProperty)?.[1] ?? filterProperty.slice(0, 8)}
              </span>
            ) : null}
            {filterStatus ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                ● {STATUS_META[filterStatus as LeadStatus]?.label ?? filterStatus}
              </span>
            ) : null}
            {filterSource ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                📍 {filterSource}
              </span>
            ) : null}
            {filterFrom || filterTo ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                📅 {filterFrom || '…'} → {filterTo || '…'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-slate-400">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
          Cargando leads…
        </div>
      )}
      {error ? <p className="rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</p> : null}

      {!loading && !error && (
        <>
          <div className="overflow-x-auto rounded-[1.6rem] ring-1 ring-slate-200 dark:ring-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {['Propiedad', 'Email', 'Teléfono', 'Estado', 'Notas del visitante', 'Origen', 'Fecha', 'Acciones'].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {leads.length === 0 ? (
                        <div className="py-2">
                          {/* Editorial empty state with image */}
                          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                            <div className="grid sm:grid-cols-2">
                              <div className="relative min-h-[220px] overflow-hidden">
                                <img
                                  src="/images/leads-empty-cta.webp"
                                  alt=""
                                  className="h-full w-full object-cover object-top"
                                  aria-hidden="true"
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/50 dark:to-slate-900/50 sm:block hidden" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:hidden" />
                              </div>
                              <div className="flex flex-col justify-center p-8">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                                  <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white">Aún no tienes interesados</h3>
                                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                  Publica tu primer tour, compártelo por WhatsApp o email y empieza a recibir leads con nombre, teléfono y propiedad visitada — todo centralizado aquí.
                                </p>
                                <a
                                  href="/properties"
                                  className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-500"
                                >
                                  Ir a propiedades
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          icon={IcoSearchX}
                          title="No hay interesados con estos filtros"
                          body="Prueba a limpiar filtros o cambia el estado seleccionado."
                          action={{ label: 'Limpiar filtros', onClick: handleClearFilters }}
                        />
                      )}
                    </td>
                  </tr>
                ) : filtered.map((l) => {
                  const isExpanded = expandedLeadId === l.id;
                  const isSaving = savingLeadId === l.id;
                  const meta = STATUS_META[l.status as LeadStatus] ?? STATUS_META.nuevo;
                  const todayEndRow = new Date(); todayEndRow.setHours(23, 59, 59, 999);
                  const isOverdueRow = !!l.nextActionAt && new Date(l.nextActionAt) <= todayEndRow && !DONE_STATUSES.has(l.status);
                  return (
                    <Fragment key={l.id}>
                      <tr
                        id={`lead-row-${l.id}`}
                        className={`bg-white transition hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 ${isOverdueRow ? 'border-l-2 border-red-400' : ''}`}
                      >
                        {/* Propiedad */}
                        <td className="max-w-[160px] truncate px-4 py-3 font-black dark:text-white" title={l.propertyTitle}>
                          {l.propertyTitle || l.propertyId.slice(0, 8)}
                        </td>
                        {/* Email */}
                        <td className="px-4 py-3 dark:text-slate-300">
                          <a href={`mailto:${l.email}`} className="font-semibold hover:underline" style={{ color: brandColor }}>
                            {l.email}
                          </a>
                        </td>
                        {/* Teléfono */}
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {l.phone ? (
                            <a href={`tel:${l.phone}`} className="hover:underline">{l.phone}</a>
                          ) : '—'}
                        </td>
                        {/* Estado — dropdown inline */}
                        <td className="px-4 py-3">
                          <select
                            value={l.status}
                            disabled={isSaving}
                            onChange={(e) => handleStatusChange(l.id, e.target.value)}
                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-black outline-none ring-1 ring-transparent focus:ring-2 disabled:opacity-50 ${meta.bg} ${meta.text}`}
                            style={{ cursor: 'pointer' }}
                          >
                            {LEAD_STATUSES.map((s) => (
                              <option key={s} value={s}>{STATUS_META[s].label}</option>
                            ))}
                          </select>
                        </td>
                        {/* Notas del visitante */}
                        <td className="max-w-[200px] px-4 py-3 text-slate-500 dark:text-slate-400">
                          {l.notes ? (
                            <span className="line-clamp-2 text-xs italic">"{l.notes}"</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        {/* Origen */}
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {l.source}
                          </span>
                        </td>
                        {/* Fecha + próxima acción */}
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{new Date(l.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {l.nextActionAt ? (
                            <p className={`mt-0.5 font-semibold ${isOverdueRow ? 'text-red-500' : 'text-slate-400'}`}>
                              {isOverdueRow ? '⚠ ' : ''}
                              {new Date(l.nextActionAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                              {l.nextActionText ? ` · ${l.nextActionText}` : ''}
                            </p>
                          ) : null}
                        </td>
                        {/* Quick actions + expand */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* Call */}
                            {l.phone ? (
                              <a
                                href={`tel:${l.phone}`}
                                title="Llamar"
                                aria-label={`Llamar a ${l.email}`}
                                className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-ip-success/10 px-2 text-ip-success transition hover:bg-ip-success/20"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.61 12 19.79 19.79 0 0 1 1.54 3.4 2 2 0 0 1 3.52 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                <span className="hidden text-xs font-semibold lg:inline">Llamar</span>
                              </a>
                            ) : null}
                            {/* WhatsApp */}
                            {l.phone ? (
                              <a
                                href={`https://wa.me/${cleanPhone(l.phone)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="WhatsApp"
                                aria-label={`Enviar WhatsApp a ${l.email}`}
                                className="flex h-7 items-center justify-center gap-1.5 rounded-full bg-ip-success/10 px-2 text-ip-success transition hover:bg-ip-success/20"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                                  <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
                                </svg>
                                <span className="hidden text-xs font-semibold lg:inline">WhatsApp</span>
                              </a>
                            ) : null}
                            {/* Copy email */}
                            <button
                              type="button"
                              title={copiedId === l.id && copiedType === 'email' ? '¡Copiado!' : 'Copiar email'}
                              aria-label="Copiar email al portapapeles"
                              onClick={() => void handleCopy(l.id, 'email', l.email)}
                              className={`flex h-7 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition ${copiedId === l.id && copiedType === 'email' ? 'bg-ip-success/15 text-ip-success' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white'}`}
                            >
                              {copiedId === l.id && copiedType === 'email' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                                </svg>
                              )}
                              <span className="hidden lg:inline">
                                {copiedId === l.id && copiedType === 'email' ? 'Copiado' : 'Email'}
                              </span>
                            </button>
                            {/* Copy property link */}
                            <button
                              type="button"
                              title={copiedId === l.id && copiedType === 'link' ? '¡Link copiado!' : 'Copiar link de la propiedad'}
                              aria-label="Copiar link de la propiedad al portapapeles"
                              onClick={() => void handleCopy(l.id, 'link', `${window.location.origin}/property/${l.propertyId}`)}
                              className={`flex h-7 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition ${copiedId === l.id && copiedType === 'link' ? 'bg-ip-success/15 text-ip-success' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white'}`}
                            >
                              {copiedId === l.id && copiedType === 'link' ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                              )}
                              <span className="hidden lg:inline">
                                {copiedId === l.id && copiedType === 'link' ? 'Copiado' : 'Link'}
                              </span>
                            </button>
                            {/* Expand */}
                            <button
                              type="button"
                              onClick={() => setExpandedLeadId(isExpanded ? null : l.id)}
                              aria-label={isExpanded ? 'Cerrar detalles' : 'Ver y editar detalles'}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              {isExpanded ? '▲' : '▼'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail panel */}
                      {isExpanded ? (
                        <tr className="bg-slate-50 dark:bg-slate-800/60">
                          <td colSpan={8} className="px-6 py-5">
                            <LeadDetailPanel
                              lead={l}
                              isSaving={isSaving}
                              saveError={saveError}
                              onSave={(patch) => void handleUpdateLead(l.id, patch)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {filtered.length !== leads.length
                ? `${filtered.length} de ${leads.length} leads`
                : `${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
            </p>
            {filtered.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleExportCsv()}
                disabled={exporting}
                className="text-xs font-black text-slate-400 transition hover:text-slate-700 disabled:opacity-50"
              >
                ↓ Exportar CSV
              </button>
            ) : null}
          </div>
        </>
      )}
    </main>
  );
}
