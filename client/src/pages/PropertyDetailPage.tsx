import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UniversalViewer from '@/components/viewer/UniversalViewer';
import { AUTH_STORAGE_KEYS, api, unwrapApiResponse } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, type ImmersiveProperty } from '@/store/propertyStore';
import type { Space, ViewerEvent } from '@/types/viewer';

interface AnalyticsCountByKey {
  key: string;
  count: number;
}

interface AnalyticsSummary {
  totalEvents: number;
  viewerOpens: number;
  hotspotClicks: number;
  spaceChanges: number;
  leadCtas: number;
  engagementScore: number;
  topSpaceId: string | null;
  topHotspotLabel: string | null;
  eventsByType: AnalyticsCountByKey[];
  eventsBySpace: AnalyticsCountByKey[];
  eventsByAsset: AnalyticsCountByKey[];
  topHotspots: AnalyticsCountByKey[];
  lastEvents: Array<{
    id: string;
    type: string;
    label: string | null;
    spaceId: string | null;
    sessionId: string | null;
    createdAt: string;
  }>;
}

interface PropertyDetailPageProps {
  propertyId: string;
  embed?: boolean;
}

function formatCurrency(value: number): string {
  if (!value) return 'Consultar';

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

function DetailStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function PropertyHero({ property, primaryColor }: { property: ImmersiveProperty; primaryColor: string }): JSX.Element {
  return (
    <div className="relative min-h-[420px] bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
      {property.coverImage ? (
        <img src={property.coverImage} alt={property.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="relative flex min-h-[420px] flex-col justify-end p-7 text-white md:p-10">
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full px-4 py-2 text-xs font-black" style={{ backgroundColor: primaryColor }}>
            Visor universal
          </span>
          <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">
            {property.type}
          </span>
          <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">
            {property.status}
          </span>
        </div>
        <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">{property.title}</h1>
      </div>
    </div>
  );
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  viewer_open: 'Apertura',
  space_change: 'Cambio espacio',
  hotspot_click: 'Hotspot',
  viewer_drag: 'Navegación',
  lead_cta: 'Lead CTA',
  asset_load_error: 'Error carga'
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  viewer_open: 'text-slate-400',
  space_change: 'text-cyan-400',
  hotspot_click: 'text-violet-400',
  viewer_drag: 'text-sky-400',
  lead_cta: 'text-emerald-400',
  asset_load_error: 'text-red-400'
};

function ScoreBadge({ score }: { score: number }): JSX.Element {
  const color = score >= 70 ? 'from-emerald-500 to-cyan-500' : score >= 35 ? 'from-amber-500 to-orange-500' : 'from-slate-600 to-slate-500';
  return (
    <div className={`flex h-20 w-20 flex-col items-center justify-center rounded-full bg-gradient-to-br ${color} shadow-lg`}>
      <span className="text-2xl font-black text-white leading-none">{score}</span>
      <span className="text-[10px] font-bold uppercase text-white/70 leading-none mt-0.5">score</span>
    </div>
  );
}

function AnalyticsDashboard({ summary, primaryColor, spaces }: {
  summary: AnalyticsSummary | null;
  primaryColor: string;
  spaces: Space[];
}): JSX.Element | null {
  if (!summary) return null;

  const topSpaceName = summary.topSpaceId
    ? (spaces.find((s) => s.id === summary.topSpaceId)?.name ?? summary.topSpaceId.slice(0, 8) + '…')
    : null;

  return (
    <section className="mt-6 overflow-hidden rounded-[1.6rem] bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-5">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
          Analytics del visor
        </p>
        <p className="mt-1 text-xs text-white/40">Comportamiento real de visitantes en esta propiedad</p>
      </div>

      <div className="p-6">
        {/* Top row: score + counters */}
        <div className="flex flex-wrap items-center gap-6">
          <ScoreBadge score={summary.engagementScore} />
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/45">Eventos</p>
              <p className="mt-1 text-3xl font-black">{summary.totalEvents}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-400/80">Hotspots</p>
              <p className="mt-1 text-3xl font-black text-violet-300">{summary.hotspotClicks}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-400/80">Lead CTAs</p>
              <p className="mt-1 text-3xl font-black text-emerald-300">{summary.leadCtas}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-400/80">Estancias</p>
              <p className="mt-1 text-3xl font-black text-cyan-300">{summary.spaceChanges}</p>
            </div>
          </div>
        </div>

        {/* Highlights row */}
        {(topSpaceName || summary.topHotspotLabel) ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {topSpaceName ? (
              <div className="flex items-center gap-2 rounded-full bg-cyan-500/15 px-4 py-2 text-sm">
                <span className="text-cyan-400 font-bold">Estancia top</span>
                <span className="text-white font-black">{topSpaceName}</span>
              </div>
            ) : null}
            {summary.topHotspotLabel ? (
              <div className="flex items-center gap-2 rounded-full bg-violet-500/15 px-4 py-2 text-sm">
                <span className="text-violet-400 font-bold">Hotspot top</span>
                <span className="text-white font-black">{summary.topHotspotLabel}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Top hotspots */}
        {summary.topHotspots.length > 0 ? (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Hotspots más clicados
            </p>
            <div className="space-y-2">
              {summary.topHotspots.map((h, i) => {
                const maxCount = summary.topHotspots[0]?.count ?? 1;
                const pct = Math.round((h.count / maxCount) * 100);
                return (
                  <div key={h.key} className="flex items-center gap-3">
                    <span className="w-4 text-right text-xs font-bold text-white/30">{i + 1}</span>
                    <div className="flex-1 rounded-xl bg-white/[0.06] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black">{h.key}</span>
                        <span className="text-sm font-bold text-violet-300">{h.count}×</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-white/10">
                        <div
                          className="h-1 rounded-full bg-violet-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Events by type */}
        {summary.eventsByType.length > 0 ? (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Distribución por tipo
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.eventsByType.map((et) => (
                <div
                  key={et.key}
                  className="flex items-center gap-2 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs"
                >
                  <span className={`font-bold ${EVENT_TYPE_COLORS[et.key] ?? 'text-white/60'}`}>
                    {EVENT_TYPE_LABELS[et.key] ?? et.key}
                  </span>
                  <span className="font-black text-white">{et.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Last events */}
        {summary.lastEvents.length > 0 ? (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Últimos eventos
            </p>
            <div className="space-y-1.5">
              {summary.lastEvents.slice(0, 6).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between rounded-xl bg-white/[0.05] px-4 py-2 text-sm"
                >
                  <span className={`font-black ${EVENT_TYPE_COLORS[ev.type] ?? 'text-white/70'}`}>
                    {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                  </span>
                  {ev.label ? (
                    <span className="mx-3 flex-1 truncate text-white/55">{ev.label}</span>
                  ) : null}
                  <span className="shrink-0 text-xs text-white/30">
                    {new Date(ev.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {summary.totalEvents === 0 ? (
          <p className="mt-4 text-sm text-white/35">
            Sin eventos registrados todavía. Abre el visor para comenzar a acumular datos.
          </p>
        ) : null}
      </div>
    </section>
  );
}

interface LeadRecord {
  id: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  createdAt: string;
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'
).replace(/\/$/, '');

function PropertyLeadsList({ propertyId, leadCount }: { propertyId: string; leadCount: number }): JSX.Element {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function handleToggle(): void {
    setOpen((v) => !v);
    if (!loaded) {
      unwrapApiResponse<LeadRecord[]>(api.get(`/leads/properties/${propertyId}`))
        .then((data) => { setLeads(data); setLoaded(true); })
        .catch(() => { setLoaded(true); });
    }
  }

  async function handleExportCsv(): Promise<void> {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
      const res = await fetch(
        `${API_BASE}/leads/properties/${propertyId}/export.csv`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // fire-and-forget — no error shown to user
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[1.6rem] bg-white ring-1 ring-slate-200">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-3"
        >
          <span className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">
            Leads capturados
          </span>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-700">
            {loaded ? leads.length : leadCount}
          </span>
          <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
        </button>

        <button
          type="button"
          onClick={() => { void handleExportCsv(); }}
          disabled={downloading}
          title="Descargar CSV"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
        >
          {downloading ? 'Exportando…' : '↓ CSV'}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-100 px-6 pb-5">
          {!loaded ? (
            <p className="pt-4 text-sm text-slate-400">Cargando leads...</p>
          ) : leads.length === 0 ? (
            <p className="pt-4 text-sm text-slate-400">Sin leads todavía. El formulario se activa desde hotspots CTA en el visor.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {leads.map((lead) => (
                <div key={lead.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900">{lead.email}</p>
                    {lead.phone ? <p className="text-sm text-slate-500">{lead.phone}</p> : null}
                    {lead.notes ? <p className="mt-1 text-sm text-slate-500 italic">"{lead.notes}"</p> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {lead.source}
                    </span>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(lead.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function PropertyDetailPage({ propertyId, embed = false }: PropertyDetailPageProps): JSX.Element {
  const navigate = useNavigate();
  const { selectedProperty, fetchPropertyById, isLoading, error, clearSelectedProperty } = usePropertyStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const primaryColor = '#7C3AED';
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [downloadingTour, setDownloadingTour] = useState(false);
  const [tourErrorMsg, setTourErrorMsg] = useState<string | null>(null);
  const [iframeCopied, setIframeCopied] = useState(false);

  function handleCopyIframe(): void {
    const embedUrl = `${window.location.origin}/embed/${propertyId}`;
    const code = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" allow="fullscreen" loading="lazy"></iframe>`;
    void navigator.clipboard.writeText(code).then(() => {
      setIframeCopied(true);
      setTimeout(() => setIframeCopied(false), 2500);
    });
  }

  async function handleDownloadTour(): Promise<void> {
    if (downloadingTour) return;
    setDownloadingTour(true);
    setTourErrorMsg(null);
    try {
      const token = window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
      const res = await fetch(
        `${API_BASE}/properties/${propertyId}/export-tour`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.status === 404) {
        setTourErrorMsg('Esta propiedad no tiene archivos exportables todavía. Sube un asset Gaussian Splat primero.');
        return;
      }
      if (!res.ok) {
        setTourErrorMsg('Error al generar el tour. Inténtalo de nuevo.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `tour-${propertyId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setTourErrorMsg('Error de conexión al generar el tour.');
    } finally {
      setDownloadingTour(false);
    }
  }

  useEffect(() => {
    void fetchPropertyById(propertyId);

    return () => {
      clearSelectedProperty();
    };
  }, [clearSelectedProperty, fetchPropertyById, propertyId]);

  useEffect(() => {
    unwrapApiResponse<AnalyticsSummary>(api.get(`/analytics/properties/${propertyId}/summary`))
      .then((data) => { setAnalyticsSummary(data); })
      .catch(() => {});
  }, [propertyId]);

  function handleAnalyticsEvent(event: ViewerEvent): void {
    window.dispatchEvent(
      new CustomEvent('immersphere:viewer-event', {
        detail: event
      })
    );
    if (event.type === 'space_change' || event.type === 'hotspot_click' || event.type === 'cta_lead') {
      setTimeout(() => {
        unwrapApiResponse<AnalyticsSummary>(api.get(`/analytics/properties/${propertyId}/summary`))
          .then((data) => { setAnalyticsSummary(data); })
          .catch(() => {});
      }, 800);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-[#F8FAFC] text-slate-950">
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-4xl font-black">Cargando propiedad...</h1>
          <p className="mt-3 text-slate-500">Conectando con el backend real.</p>
        </section>
      </main>
    );
  }

  if (error || !selectedProperty) {
    return (
      <main className="min-h-[calc(100vh-73px)] bg-[#F8FAFC] text-slate-950">
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-4xl font-black">Propiedad no encontrada</h1>
          {error ? <p className="mt-3 text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={() => navigate('/gallery')}
            className="mt-8 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white"
          >
            Volver a galería
          </button>
        </section>
      </main>
    );
  }

  const property = selectedProperty;

  return (
    <main className={embed ? 'bg-[#F8FAFC] text-slate-950' : 'min-h-[calc(100vh-73px)] bg-[#F8FAFC] text-slate-950'}>
      <section className="mx-auto max-w-7xl px-5 py-10">
        {!embed ? (
          <Link
            to="/gallery"
            className="mb-5 inline-flex rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            ← Volver a galería
          </Link>
        ) : null}

        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70">
          <PropertyHero property={property} primaryColor={primaryColor} />

          <div className="grid grid-cols-1 gap-8 p-7 md:p-10 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DetailStat label="Precio" value={formatCurrency(property.price)} />
                <DetailStat label="Superficie" value={`${property.area} m²`} />
                <DetailStat label="Habitaciones" value={property.rooms} />
                <DetailStat label="Baños" value={property.bathrooms} />
              </div>

              <section className="mt-8 rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200">
                <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>
                  Descripción comercial
                </p>
                <p className="mt-4 leading-8 text-slate-600">{property.description}</p>
              </section>

              <UniversalViewer
                propertyId={property.id}
                spaces={property.spaces}
                primaryColor={primaryColor}
                className="mt-8"
                onAnalyticsEvent={handleAnalyticsEvent}
              />

              <AnalyticsDashboard summary={analyticsSummary} primaryColor={primaryColor} spaces={property.spaces} />

              {isAuthenticated ? (
                <PropertyLeadsList
                  propertyId={property.id}
                  leadCount={analyticsSummary?.leadCtas ?? property.leads ?? 0}
                />
              ) : null}
            </div>

            <aside className="rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200">
              <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>
                Señales de intención
              </p>
              <div className="mt-5 space-y-4">
                <DetailStat
                  label="Aperturas del visor"
                  value={analyticsSummary ? formatNumber(analyticsSummary.viewerOpens) : '—'}
                />
                <DetailStat
                  label="Leads generados"
                  value={analyticsSummary ? formatNumber(analyticsSummary.leadCtas) : '—'}
                />
                <DetailStat
                  label="Engagement score"
                  value={analyticsSummary ? `${analyticsSummary.engagementScore}/100` : '—'}
                />
              </div>
              <button
                type="button"
                className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Contactar agente
              </button>
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => { void handleDownloadTour(); }}
                    disabled={downloadingTour}
                    className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40"
                  >
                    {downloadingTour ? 'Generando ZIP…' : '↓ Descargar tour'}
                  </button>
                  {tourErrorMsg ? (
                    <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 ring-1 ring-amber-200">
                      {tourErrorMsg}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleCopyIframe}
                    className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {iframeCopied ? '✓ Código copiado' : '</> Copiar código iframe'}
                  </button>
                </>
              ) : null}
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                En producción, este CTA abrirá lead, email, CRM o reserva de visita física.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
