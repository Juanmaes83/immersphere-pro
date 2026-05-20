import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import QRCode from 'qrcode';
import ChatbotWidget from '@/components/ChatbotWidget';
import { t } from '@/i18n/dictionary';

const PropertyMap = lazy(() => import('@/components/PropertyMap'));
import UniversalViewer from '@/components/viewer/UniversalViewer';
import LeadCaptureModal from '@/components/viewer/LeadCaptureModal';
import { AUTH_STORAGE_KEYS, api, unwrapApiResponse } from '@/services/api';
import { geocodeAddress } from '@/utils/googleMaps';
import { propertyShareUrl } from '@/utils/slugify';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import NeighborhoodSection from '@/components/NeighborhoodSection';
import LumaSection from '@/components/LumaSection';
import ShareModal from '@/components/ShareModal';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, type ImmersiveProperty } from '@/store/propertyStore';
import type { Space, ViewerEvent } from '@/types/viewer';
import { formatCurrency } from '@/utils/format';

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


function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

function DetailStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function PropertyHero({ property, primaryColor }: { property: ImmersiveProperty; primaryColor: string }): JSX.Element {
  return (
    <div className="relative min-h-[420px] bg-gradient-to-br from-violet-400/35 via-fuchsia-500/20 to-slate-950">
      {property.coverImage ? (
        <img src={property.coverImage} alt={property.title} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="relative flex min-h-[420px] flex-col justify-end p-7 text-white md:p-10">
        <div className="mb-5 flex flex-wrap gap-2">
          <span className="rounded-full px-4 py-2 text-xs font-black" style={{ backgroundColor: primaryColor }}>
            Tour inmersivo
          </span>
          <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">
            {({'APARTMENT':'Apartamento','HOUSE':'Casa','VILLA':'Villa','OFFICE':'Oficina','COMMERCIAL':'Comercial'} as Record<string,string>)[property.type] ?? property.type}
          </span>
          <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">
            {({'PUBLISHED':'Publicado','DRAFT':'Borrador','ARCHIVED':'Archivado'} as Record<string,string>)[property.status] ?? property.status}
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
  hotspot_click: 'Punto interactivo',
  viewer_drag: 'Navegación',
  lead_cta: 'Contacto',
  asset_load_error: 'Error carga',
  viewer_whatsapp_click: 'WhatsApp',
  tour_start: 'Tour iniciado',
  tour_step: 'Paso de tour',
  tour_complete: 'Tour completado'
};

const EVENT_TYPE_COLORS: Record<string, string> = {
  viewer_open: 'text-slate-400',
  space_change: 'text-violet-400',
  hotspot_click: 'text-violet-400',
  viewer_drag: 'text-slate-400',
  lead_cta: 'text-emerald-400',
  asset_load_error: 'text-red-400',
  viewer_whatsapp_click: 'text-green-400',
  tour_start: 'text-amber-400',
  tour_step: 'text-amber-300',
  tour_complete: 'text-emerald-300'
};

function ScoreBadge({ score }: { score: number }): JSX.Element {
  const color = score >= 70 ? 'from-emerald-500 to-violet-500' : score >= 35 ? 'from-amber-500 to-orange-500' : 'from-slate-600 to-slate-500';
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
        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">
          Rendimiento del recorrido
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
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-400/80">Puntos interactivos</p>
              <p className="mt-1 text-3xl font-black text-violet-300">{summary.hotspotClicks}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-400/80">Contactos</p>
              <p className="mt-1 text-3xl font-black text-emerald-300">{summary.leadCtas}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.07] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-400/80">Estancias</p>
              <p className="mt-1 text-3xl font-black text-violet-300">{summary.spaceChanges}</p>
            </div>
          </div>
        </div>

        {/* Highlights row */}
        {(topSpaceName || summary.topHotspotLabel) ? (
          <div className="mt-5 flex flex-wrap gap-3">
            {topSpaceName ? (
              <div className="flex items-center gap-2 rounded-full bg-violet-500/15 px-4 py-2 text-sm">
                <span className="text-violet-400 font-bold">Estancia top</span>
                <span className="text-white font-black">{topSpaceName}</span>
              </div>
            ) : null}
            {summary.topHotspotLabel ? (
              <div className="flex items-center gap-2 rounded-full bg-violet-500/15 px-4 py-2 text-sm">
                <span className="text-violet-400 font-bold">Punto más visitado</span>
                <span className="text-white font-black">{summary.topHotspotLabel}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Top hotspots */}
        {summary.topHotspots.length > 0 ? (
          <div className="mt-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-white/40">
              Puntos más visitados
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

function PropertyQRCode({
  propertyId,
  primaryColor,
  propertyTitle,
  agencyName,
  lang,
  onQrOpen
}: {
  propertyId: string;
  primaryColor: string;
  propertyTitle?: string;
  agencyName?: string;
  lang?: string;
  onQrOpen?: () => void;
}): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [linkCopiedQR, setLinkCopiedQR] = useState(false);

  // QR must use the same canonical slug URL as ShareModal and og:url
  const tourUrl = propertyShareUrl(propertyId, propertyTitle ?? '');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, tourUrl, {
      width: 180, margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    }).then(() => setReady(true)).catch(() => {});
  }, [tourUrl]);

  useEffect(() => {
    if (!showFullscreen || !fullscreenCanvasRef.current) return;
    QRCode.toCanvas(fullscreenCanvasRef.current, tourUrl, {
      width: 280, margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' }
    }).catch(() => {});
  }, [showFullscreen, tourUrl]);

  useEffect(() => {
    if (!showFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowFullscreen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showFullscreen]);

  function handleDownload(): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `qr-tour-${propertyId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function handleCopyLink(): void {
    void navigator.clipboard.writeText(tourUrl).then(() => {
      setLinkCopiedQR(true);
      setTimeout(() => setLinkCopiedQR(false), 1800);
    });
  }

  return (
    <>
      {/* ── Widget compacto (aside) ─────────────────────────────────────── */}
      <div className="mt-5 overflow-hidden rounded-[1.4rem] bg-slate-950">
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>
            {t(lang, 'qr_label')}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowFullscreen(true); onQrOpen?.(); }}
              title={t(lang, 'qr_fullscreen_title')}
              className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] text-white/50 transition hover:border-white/35 hover:text-white"
            >
              ⛶
            </button>
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black text-black" style={{ backgroundColor: primaryColor }}>
              SCAN
            </span>
          </div>
        </div>
        <div className="flex justify-center px-5 py-4">
          <div className="rounded-xl bg-white p-3 shadow-lg">
            <canvas ref={canvasRef} className={ready ? '' : 'opacity-0'} />
          </div>
        </div>
        <div className="px-5 pb-4">
          <p className="mb-2.5 text-center text-[10px] text-white/40">{t(lang, 'qr_scan_to_open')}</p>
          <button
            type="button"
            onClick={handleDownload}
            className="w-full rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-white/70 transition hover:border-white/25 hover:text-white"
          >
            {t(lang, 'qr_download')}
          </button>
        </div>
      </div>

      {/* ── Modal fullscreen premium ───────────────────────────────────── */}
      {showFullscreen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-5 backdrop-blur-md"
          style={{ backgroundColor: 'rgba(2,6,23,0.93)' }}
          onClick={() => setShowFullscreen(false)}
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-[2rem] bg-slate-900 shadow-2xl ring-1 ring-white/10"
            style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="border-b border-white/[0.07] px-8 pt-8 pb-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {agencyName ? (
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: primaryColor }}>
                      {agencyName}
                    </p>
                  ) : null}
                  <h2 className="mt-2 truncate text-2xl font-black leading-snug tracking-tight">
                    {propertyTitle ?? t(lang, 'qr_modal_title_fallback')}
                  </h2>
                  <p className="mt-2 text-sm text-white/40">
                    {t(lang, 'qr_modal_subtitle')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullscreen(false)}
                  className="shrink-0 rounded-full p-2.5 text-white/35 transition hover:bg-white/10 hover:text-white"
                  aria-label={t(lang, 'close')}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* QR */}
            <div className="flex flex-col items-center px-8 py-9">
              <div className="rounded-2xl bg-white p-5 shadow-xl" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                <canvas ref={fullscreenCanvasRef} />
              </div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.22em] text-white/25">
                {t(lang, 'qr_modal_tagline')}
              </p>
            </div>

            {/* Footer CTA */}
            <div className="border-t border-white/[0.07] px-8 py-6">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full rounded-2xl border border-white/15 px-5 py-3.5 text-sm font-black text-white/60 transition hover:border-white/30 hover:text-white"
              >
                {linkCopiedQR ? t(lang, 'qr_link_copied') : t(lang, 'qr_copy_link')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function PropertyDetailPage({ propertyId, embed = false }: PropertyDetailPageProps): JSX.Element {
  const navigate = useNavigate();
  const { selectedProperty, fetchPropertyById, unlockProperty, updateProperty, isLoading, error, clearSelectedProperty } = usePropertyStore();
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSummary | null>(null);
  const [downloadingTour, setDownloadingTour] = useState(false);
  const [tourErrorMsg, setTourErrorMsg] = useState<string | null>(null);
  const [iframeCopied, setIframeCopied] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [waVisible, setWaVisible] = useState(false);

  // ── Address / geocoding editor (auth only) ────────────────────────────────
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState('');
  const [addrGeoStatus, setAddrGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [addrSaving, setAddrSaving] = useState(false);

  async function geocodeAndSave(): Promise<void> {
    const query = addressDraft.trim();
    if (!query || !selectedProperty) return;
    setAddrGeoStatus('loading');
    try {
      const coords = await geocodeAddress(query);
      if (!coords) {
        setAddrGeoStatus('error');
        return;
      }
      setAddrGeoStatus('ok');
      setAddrSaving(true);
      await updateProperty(selectedProperty.id, { address: query, latitude: coords.lat, longitude: coords.lng });
      await fetchPropertyById(selectedProperty.id);
      setEditingAddress(false);
    } catch {
      setAddrGeoStatus('error');
    } finally {
      setAddrSaving(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { setWaVisible(true); }, 4000);
    return () => { clearTimeout(t); };
  }, []);

  /** Fire-and-forget analytics event for share interactions. */
  function trackShareEvent(channel: 'whatsapp' | 'copy' | 'native' | 'qr'): void {
    if (!property) return;
    const sessionId = sessionStorage.getItem('immersphere_session_id') ?? undefined;
    const apiBase = (
      import.meta.env.VITE_API_BASE_URL ??
      import.meta.env.VITE_API_URL ??
      'http://localhost:4000/api'
    ).replace(/\/$/, '');
    fetch(`${apiBase}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: property.id,
        type: channel === 'qr' ? 'qr_opened' : 'share_clicked',
        payload: { channel, assetType: hasGaussian ? 'gaussian_splat' : 'panorama_360' },
        sessionId
      })
    }).catch(() => {});
  }

  function handleCopyLink(): void {
    const url = propertyShareUrl(propertyId, selectedProperty?.title ?? '');
    void navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
      trackShareEvent('copy');
    });
  }

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
        setTourErrorMsg(t(lang, 'tour_no_asset'));
        return;
      }
      if (!res.ok) {
        setTourErrorMsg(t(lang, 'tour_export_error'));
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
      setTourErrorMsg(t(lang, 'tour_network_error'));
    } finally {
      setDownloadingTour(false);
    }
  }

  useEffect(() => {
    void fetchPropertyById(propertyId);
    fetch(`${API_BASE}/properties/${propertyId}/view`, { method: 'POST' }).catch(() => {});

    return () => {
      clearSelectedProperty();
    };
  }, [clearSelectedProperty, fetchPropertyById, propertyId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    unwrapApiResponse<AnalyticsSummary>(api.get(`/analytics/properties/${propertyId}/summary`))
      .then((data) => { setAnalyticsSummary(data); })
      .catch(() => {});
  }, [propertyId, isAuthenticated]);

  // Dynamic favicon: colored square using tenant primary color
  useEffect(() => {
    const color = selectedProperty?.tenantPrimaryColor || '#7C3AED';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${color}"/></svg>`;
    const faviconHref = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const wasCreated = !link;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const prevHref = link.href;
    link.href = faviconHref;
    return () => {
      if (link) link.href = wasCreated ? '' : prevHref;
    };
  }, [selectedProperty?.tenantPrimaryColor]);

  function handleAnalyticsEvent(event: ViewerEvent): void {
    window.dispatchEvent(
      new CustomEvent('immersphere:viewer-event', {
        detail: event
      })
    );
    if (isAuthenticated && (event.type === 'space_change' || event.type === 'hotspot_click' || event.type === 'cta_lead')) {
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
        <section className="mx-auto flex max-w-3xl flex-col items-center px-5 py-24 text-center">
          <div className="mb-6 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
          <p className="text-lg font-black text-slate-950">Cargando propiedad...</p>
          <p className="mt-2 text-sm text-slate-400">Un momento</p>
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

  if (selectedProperty.isPasswordProtected) {
    async function handleUnlock(event: React.FormEvent): Promise<void> {
      event.preventDefault();
      setPasswordError(null);
      setUnlocking(true);
      const result = await unlockProperty(propertyId, passwordInput);
      if (!result) setPasswordError('Contraseña incorrecta. Inténtalo de nuevo.');
      setUnlocking(false);
    }
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-[#F8FAFC] px-5">
        <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          {selectedProperty.coverImage ? (
            <img src={selectedProperty.coverImage} alt={selectedProperty.title} className="mb-6 h-40 w-full rounded-[1.3rem] object-cover" />
          ) : null}
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">Propiedad protegida</p>
          <h1 className="mt-2 text-3xl font-black">{selectedProperty.title}</h1>
          <p className="mt-3 text-sm text-slate-500">Esta propiedad requiere contraseña para ver el tour.</p>
          <form onSubmit={(e) => { void handleUnlock(e); }} className="mt-6 flex flex-col gap-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Contraseña del tour"
              autoFocus
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-violet-400"
            />
            {passwordError ? <p className="text-sm font-bold text-red-600">{passwordError}</p> : null}
            <button
              type="submit"
              disabled={unlocking || !passwordInput}
              className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {unlocking ? 'Verificando...' : 'Entrar al tour'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const property = selectedProperty;
  const primaryColor = property.tenantPrimaryColor || '#7C3AED';
  const lang = property.language ?? 'es';
  const hasGaussian = property.spaces.some((s) => s.assets.some((a) => a.type === 'gaussian_splat'));

  const ogTitle = property.title;
  const rawDesc = (property.description ?? '').replace(/\s+/g, ' ').trim();
  const ogDescription = rawDesc.slice(0, 150) || [
    t(lang, 'share_tour_suffix'),
    property.area ? `${property.area} m²` : '',
    property.rooms ? `${property.rooms} hab.` : '',
    property.type
  ].filter(Boolean).join(' · ');
  const ogImage = property.coverImage ?? '';
  const ogUrl = propertyShareUrl(property.id, property.title);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: ogTitle,
    description: ogDescription,
    url: ogUrl,
    ...(ogImage ? { image: ogImage } : {}),
    ...(property.price ? { offers: { '@type': 'Offer', price: property.price, priceCurrency: 'EUR' } } : {}),
    ...(property.area ? { floorSize: { '@type': 'QuantitativeValue', value: property.area, unitCode: 'MTK' } } : {}),
    numberOfRooms: property.rooms,
    numberOfBathroomsTotal: property.bathrooms,
    additionalType: property.type,
    // QW-2: GeoCoordinates for local SEO — only when coordinates are available
    ...(property.latitude && property.longitude ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: property.latitude,
        longitude: property.longitude,
      },
    } : {}),
    ...(property.address ? { address: property.address } : {}),
    provider: {
      '@type': 'Organization',
      name: property.removeBranding ? `Agencia (${property.tenantId.slice(0, 8)})` : 'Immersphere Pro',
      ...(property.removeBranding ? {} : { url: 'https://immersphere.pro' })
    }
  };

  return (
    <main className={embed ? 'bg-[#F8FAFC] text-slate-950' : 'min-h-[calc(100vh-73px)] bg-[#F8FAFC] text-slate-950'}>
      <Helmet>
        <title>{property.removeBranding ? ogTitle : `${ogTitle} · Immersphere Pro`}</title>
        <meta name="description" content={ogDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        {/* S3.1: canonical for client-side nav; middleware also injects this for crawlers */}
        <link rel="canonical" href={ogUrl} />
      </Helmet>
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
                <DetailStat label={t(lang, 'stat_price')} value={formatCurrency(property.price)} />
                <DetailStat label={t(lang, 'stat_area')} value={`${property.area} m²`} />
                <DetailStat label={t(lang, 'stat_rooms')} value={property.rooms} />
                <DetailStat label={t(lang, 'stat_bathrooms')} value={property.bathrooms} />
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
                removeBranding={property.removeBranding}
                language={lang}
                propertyTitle={property.title}
                agencyName={property.tenantLogoText || property.tenantName || 'Agencia inmobiliaria'}
                agencyLogoUrl={property.tenantLogoUrl || undefined}
                floorplanUrl={property.floorplanUrl || undefined}
                className="mt-8"
                onAnalyticsEvent={handleAnalyticsEvent}
              />

              {/* ── Map + address editor ── */}
              {property.latitude && property.longitude ? (
                <>
                  <ErrorBoundary fallback={null}>
                    <Suspense fallback={<div className="mt-8 h-[320px] rounded-[1.6rem] bg-slate-100 ring-1 ring-slate-200" />}>
                      <PropertyMap lat={property.latitude} lng={property.longitude} title={property.title} />
                    </Suspense>
                  </ErrorBoundary>
                  <NeighborhoodSection lat={property.latitude} lng={property.longitude} />
                  <LumaSection property={property} isAuthenticated={isAuthenticated} />
                  {isAuthenticated && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span className="truncate">{property.address || `${property.latitude.toFixed(4)}, ${property.longitude.toFixed(4)}`}</span>
                      <button type="button" onClick={() => { setAddressDraft(property.address ?? ''); setEditingAddress(true); setAddrGeoStatus('idle'); }} className="shrink-0 font-bold text-slate-500 hover:text-blue-600">
                        Editar
                      </button>
                    </div>
                  )}
                </>
              ) : isAuthenticated ? (
                <div className="mt-8 rounded-[1.6rem] border-2 border-dashed border-slate-200 p-6 dark:border-slate-700">
                  <p className="text-sm font-black text-slate-500">📍 Sin ubicación — añade la dirección para mostrar el mapa</p>
                  {!editingAddress ? (
                    <button type="button" onClick={() => { setAddressDraft(''); setEditingAddress(true); setAddrGeoStatus('idle'); }} className="mt-3 text-sm font-black text-blue-600 hover:underline">
                      + Añadir dirección
                    </button>
                  ) : null}
                </div>
              ) : (
                /* QW-3: public fallback when coordinates are not set */
                <div className="mt-8 flex h-20 items-center justify-center gap-2 rounded-[1.6rem] bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                  <svg className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Ubicación no disponible</p>
                </div>
              )}

              {/* ── Inline address editor ── */}
              {isAuthenticated && editingAddress && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                  <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Dirección de la propiedad</p>
                  <div className="flex gap-2">
                    <AddressAutocomplete
                      value={addressDraft}
                      onChange={(v) => { setAddressDraft(v); setAddrGeoStatus('idle'); }}
                      onSelect={({ address, lat, lng }) => {
                        setAddressDraft(address);
                        // Direct coordinates from autocomplete — save immediately
                        void (async () => {
                          setAddrGeoStatus('ok');
                          setAddrSaving(true);
                          try {
                            await updateProperty(selectedProperty!.id, { address, latitude: lat, longitude: lng });
                            await fetchPropertyById(selectedProperty!.id);
                            setEditingAddress(false);
                          } finally {
                            setAddrSaving(false);
                          }
                        })();
                      }}
                      geocodeStatus={addrGeoStatus}
                      onKeyDown={(e) => { if (e.key === 'Enter') void geocodeAndSave(); if (e.key === 'Escape') setEditingAddress(false); }}
                      placeholder="Ej: Gran Vía 32, Madrid"
                      autoFocus
                      inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => void geocodeAndSave()}
                      disabled={addrSaving || !addressDraft.trim()}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      {addrSaving ? '…' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => setEditingAddress(false)} className="rounded-xl px-3 py-2 text-sm font-black text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                  {addrGeoStatus === 'ok'    && <p className="mt-1.5 text-xs font-semibold text-emerald-600">✅ Ubicación encontrada</p>}
                  {addrGeoStatus === 'error' && <p className="mt-1.5 text-xs font-semibold text-amber-500">⚠️ Dirección no encontrada. Prueba sin "Calle" — ej: <em>Gran Vía 32, Madrid</em></p>}
                  {addrGeoStatus === 'loading' && <p className="mt-1.5 text-xs font-semibold text-slate-400">Buscando…</p>}
                </div>
              )}

              {isAuthenticated ? (
                <AnalyticsDashboard summary={analyticsSummary} primaryColor={primaryColor} spaces={property.spaces} />
              ) : null}

              {isAuthenticated ? (
                <PropertyLeadsList
                  propertyId={property.id}
                  leadCount={analyticsSummary?.leadCtas ?? property.leads ?? 0}
                />
              ) : null}
            </div>

            <aside className="rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200">
              {isAuthenticated ? (
                <>
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
                </>
              ) : null}
              {property.tenantWhatsapp?.replace(/\D/g, '').length ? (
                <a
                  href={`https://wa.me/${property.tenantWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`${property.title} — ${t(lang, hasGaussian ? 'share_tour_suffix_3d' : 'share_tour_suffix')} · ${ogUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { trackShareEvent('whatsapp'); }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {t(lang, 'contact_whatsapp')}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowContactModal(true)}
                  className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  Contactar agente
                </button>
              )}
              {!embed ? (
                <button
                  type="button"
                  onClick={() => { setShowShareModal(true); trackShareEvent('native'); }}
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
                >
                  {t(lang, 'share_btn')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {linkCopied ? t(lang, 'share_link_copied') : t(lang, 'share_copy_link')}
              </button>
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={() => { void handleDownloadTour(); }}
                    disabled={downloadingTour}
                    className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40"
                  >
                    {downloadingTour ? t(lang, 'share_generating') : t(lang, 'share_download')}
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
                    {iframeCopied ? t(lang, 'share_iframe_copied') : t(lang, 'share_copy_iframe')}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const url = `/property/${property.id}/mobile`;
                  const isMobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                  if (isMobile) {
                    window.location.href = url;
                  } else {
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="mt-3 w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
              >
                {t(lang, 'share_mobile_view')}
              </button>
              {!embed ? (
                <PropertyQRCode propertyId={property.id} primaryColor={primaryColor} propertyTitle={property.title} agencyName={property.tenantLogoText || property.tenantName || undefined} lang={lang} onQrOpen={() => { trackShareEvent('qr'); }} />
              ) : null}
            </aside>
          </div>
        </div>
      </section>
      {!embed ? (
        <ChatbotWidget
          propertyId={property.id}
          propertyTitle={property.title}
          tenantPhone={property.tenantPhone}
          primaryColor={primaryColor}
        />
      ) : null}
      {showContactModal ? (
        <LeadCaptureModal
          propertyId={property.id}
          hotspotLabel="Contactar agente"
          primaryColor={primaryColor}
          lang={lang}
          onClose={() => setShowContactModal(false)}
          onSubmitted={() => setShowContactModal(false)}
        />
      ) : null}
      {showShareModal ? (
        <ShareModal
          propertyId={property.id}
          title={property.title}
          description={property.description ?? undefined}
          imageUrl={property.coverImage ?? undefined}
          primaryColor={primaryColor}
          onClose={() => setShowShareModal(false)}
        />
      ) : null}
      {property.tenantWhatsapp && !embed ? (
        <a
          href={`https://wa.me/${property.tenantWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`${property.title} — ${t(lang, hasGaussian ? 'share_tour_suffix_3d' : 'share_tour_suffix')} · ${ogUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(lang, 'contact_whatsapp')}
          title={t(lang, 'contact_whatsapp')}
          onClick={() => {
            fetch(`${API_BASE}/analytics/events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                propertyId: property.id,
                type: 'viewer_whatsapp_click',
                label: 'floating_button'
              })
            }).catch(() => {});
          }}
          className={`fixed bottom-5 left-5 z-[9989] flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-500 hover:scale-105 focus:outline-none ${waVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
          style={{ backgroundColor: '#25D366' }}
        >
          <svg viewBox="0 0 24 24" fill="white" className="h-7 w-7" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      ) : null}
    </main>
  );
}
