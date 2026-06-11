import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import PropertyVideoHero from '@/components/PropertyVideoHero';
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
import { getAccessLevel, getDaysUntilNextRestriction } from '@/utils/gracePeriod';

// ── Pantalla de bloqueo (grace period día 16+) ────────────────────────────────
function SubscriptionBlockedScreen({ property }: { property: ImmersiveProperty }): JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-center">
      <div className="w-full max-w-md">
        {property.coverImage ? (
          <img
            src={property.coverImage}
            alt={property.title}
            className="mx-auto mb-8 h-32 w-full rounded-2xl object-cover opacity-30 saturate-0"
          />
        ) : null}
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: '#1e1b4b' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-violet-500">Tour no disponible</p>
        <h1 className="mt-3 text-2xl font-black text-white">{property.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          La suscripción de esta agencia ha expirado.<br />
          El tour virtual no está disponible en este momento.
        </p>
        {property.tenantPhone ? (
          <a
            href={`tel:${property.tenantPhone}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-black text-white transition hover:bg-violet-500"
          >
            Contactar agencia →
          </a>
        ) : null}
        <p className="mt-8 text-xs text-slate-600">
          ¿Eres el propietario?{' '}
          <a href="https://immersphere-pro.vercel.app/settings" className="font-bold text-violet-500 hover:underline">
            Reactivar plan →
          </a>
        </p>
      </div>
    </main>
  );
}

// ── Banner readonly (grace period días 8-15) ──────────────────────────────────
function ReadonlyBanner({ daysLeft }: { daysLeft: number }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500/10 px-4 py-2.5 text-center text-xs font-bold text-amber-700">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-amber-500">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
      <span>
        Suscripción expirada — contacto desactivado.
        {daysLeft > 0 ? ` Este tour se bloqueará en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}.` : ' Tour bloqueado próximamente.'}
      </span>
    </div>
  );
}

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

// ─── Mortgage Simulator ───────────────────────────────────────────────────────
// Fórmula francesa — estándar en España. Cálculo 100% client-side, sin APIs.
function calcularCuota(precio: number, entradaPct: number, anos: number, interesAnual: number): number {
  const capital = precio * (1 - entradaPct / 100);
  const r = (interesAnual / 100) / 12;
  const n = anos * 12;
  if (r === 0) return Math.round(capital / n);
  return Math.round(capital * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}

function MortgageSimulator({ price, primaryColor }: { price: number; primaryColor: string }): JSX.Element | null {
  const [entrada, setEntrada] = useState(20);   // %
  const [anos, setAnos] = useState(30);
  const [interes, setInteres] = useState(3.5);  // %

  if (!price || price <= 0) return null;

  const cuota = calcularCuota(price, entrada, anos, interes);
  const capitalPrestado = Math.round(price * (1 - entrada / 100));
  const entradaEur = Math.round(price * entrada / 100);
  const totalPagado = cuota * anos * 12;
  const totalIntereses = totalPagado - capitalPrestado;

  const fmtEur = (n: number): string =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" style={{ color: primaryColor }} aria-hidden="true">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
        <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
          Simulador de hipoteca
        </p>
      </div>

      {/* Cuota destacada */}
      <div className="mt-4 rounded-xl py-3 text-center" style={{ backgroundColor: `${primaryColor}12` }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Cuota mensual estimada</p>
        <p className="mt-1 text-3xl font-black text-slate-950">{fmtEur(cuota)}<span className="ml-1 text-base font-bold text-slate-400">/mes</span></p>
      </div>

      {/* Controls */}
      <div className="mt-4 space-y-4">
        {/* Entrada */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500">Entrada</label>
            <span className="text-xs font-black text-slate-900">{entrada}% · {fmtEur(entradaEur)}</span>
          </div>
          <input
            type="range"
            min={10} max={50} step={5}
            value={entrada}
            onChange={(e) => setEntrada(Number(e.target.value))}
            className="mt-1.5 w-full accent-violet-600"
            style={{ accentColor: primaryColor }}
            aria-label="Porcentaje de entrada"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>10%</span><span>50%</span>
          </div>
        </div>

        {/* Plazo */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500">Plazo</label>
            <span className="text-xs font-black text-slate-900">{anos} años</span>
          </div>
          <select
            value={anos}
            onChange={(e) => setAnos(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
            aria-label="Plazo en años"
          >
            {[15, 20, 25, 30, 35, 40].map((a) => (
              <option key={a} value={a}>{a} años</option>
            ))}
          </select>
        </div>

        {/* Interés */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500">Tipo de interés</label>
            <span className="text-xs font-black text-slate-900">{interes.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={1} max={8} step={0.1}
            value={interes}
            onChange={(e) => setInteres(Number(e.target.value))}
            className="mt-1.5 w-full"
            style={{ accentColor: primaryColor }}
            aria-label="Tipo de interés anual"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>1%</span><span>8%</span>
          </div>
        </div>
      </div>

      {/* Resumen compacto */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Préstamo</p>
          <p className="text-sm font-black text-slate-800">{fmtEur(capitalPrestado)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total intereses</p>
          <p className="text-sm font-black text-slate-800">{fmtEur(totalIntereses)}</p>
        </div>
      </div>

      {/* Disclaimer legal */}
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-slate-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Cálculo orientativo basado en tipo fijo. Consulta condiciones reales con tu banco o gestor financiero.
      </p>
    </div>
  );
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
        {/* Price + key stats overlay — buyer-first info above the fold */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {property.price && property.price > 0 ? (
            <span className="rounded-2xl bg-white/15 px-4 py-2 text-xl font-black backdrop-blur">
              {formatCurrency(property.price)}
            </span>
          ) : null}
          {property.area ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold backdrop-blur text-white/85">
              {property.area} m²
            </span>
          ) : null}
          {property.rooms ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold backdrop-blur text-white/85">
              {property.rooms} hab.
            </span>
          ) : null}
          {property.bathrooms ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-bold backdrop-blur text-white/85">
              {property.bathrooms} baños
            </span>
          ) : null}
        </div>
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        </button>

        <button
          type="button"
          onClick={() => { void handleExportCsv(); }}
          disabled={downloading}
          title="Descargar CSV"
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"
        >
          {downloading ? 'Exportando…' : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              CSV
            </>
          )}
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
  const [isDesktopImmersiveViewport, setIsDesktopImmersiveViewport] = useState(() =>
    window.matchMedia('(min-width: 1024px)').matches
  );

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

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const handleChange = (event: MediaQueryListEvent): void => {
      setIsDesktopImmersiveViewport(event.matches);
    };
    setIsDesktopImmersiveViewport(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
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

  function buildRoomDesignerUrl(): string {
    const url = new URL('https://immersphere-asset-lab.vercel.app/scenes/room-designer/index.html');
    url.searchParams.set('source', 'saas');
    url.searchParams.set('propertyId', property.id);
    url.searchParams.set('propertyTitle', property.title);
    url.searchParams.set('propertyType', property.type);
    if (property.tenantId) url.searchParams.set('tenantId', property.tenantId);
    return url.toString();
  }

  const primaryColor = property.tenantPrimaryColor || '#7C3AED';
  const lang = property.language ?? 'es';
  const hasGaussian = property.spaces.some((s) => s.assets.some((a) => a.type === 'gaussian_splat'));

  // ── Grace period ──────────────────────────────────────────────────────────
  const accessLevel = getAccessLevel(property.tenantSubscriptionStatus, property.tenantSubscriptionUpdatedAt);
  const daysUntilBlock = getDaysUntilNextRestriction(property.tenantSubscriptionUpdatedAt);
  const isLeadDisabled = accessLevel !== 'full';

  if (accessLevel === 'blocked') {
    return <SubscriptionBlockedScreen property={property} />;
  }

  // AR is available on Pro, Agency and Enterprise plans (not Starter).
  const AR_PLANS = new Set(['PROFESSIONAL', 'AGENCY', 'ENTERPRISE']);
  const arEnabled = AR_PLANS.has(property.tenantPlan ?? '');
  const handleViewerBack = (): void => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    navigate('/dashboard');
  };

  // ── Embed mode: render ONLY the 3D viewer, no ficha ─────────────────────────
  if (embed) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-950">
        {accessLevel === 'readonly' ? <ReadonlyBanner daysLeft={daysUntilBlock} /> : null}
        <UniversalViewer
          propertyId={property.id}
          spaces={property.spaces}
          primaryColor={primaryColor}
          removeBranding={property.removeBranding}
          language={lang}
          propertyTitle={property.title}
          agencyName={property.tenantLogoText || property.tenantName || 'Agencia inmobiliaria'}
          agencyLogoUrl={property.tenantLogoUrl || undefined}
          tenantWhatsapp={property.tenantWhatsapp}
          tenantCalendlyUrl={property.tenantCalendlyUrl}
          floorplanUrl={property.floorplanUrl || undefined}
          guidedConfig={property.guidedConfig}
          arEnabled={arEnabled}
          onAnalyticsEvent={handleAnalyticsEvent}
          disableLeadCapture={isLeadDisabled}
        />
      </div>
    );
  }

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
      {isDesktopImmersiveViewport ? (
      <section className="bg-slate-950">
        {accessLevel === 'readonly' ? <ReadonlyBanner daysLeft={daysUntilBlock} /> : null}
        <UniversalViewer
          propertyId={property.id}
          spaces={property.spaces}
          primaryColor={primaryColor}
          removeBranding={property.removeBranding}
          language={lang}
          propertyTitle={property.title}
          agencyName={property.tenantLogoText || property.tenantName || 'Agencia inmobiliaria'}
          agencyLogoUrl={property.tenantLogoUrl || undefined}
          tenantWhatsapp={property.tenantWhatsapp}
          tenantCalendlyUrl={property.tenantCalendlyUrl}
          floorplanUrl={property.floorplanUrl || undefined}
          guidedConfig={property.guidedConfig}
          arEnabled={arEnabled}
          desktopImmersive
          onBack={handleViewerBack}
          onAnalyticsEvent={handleAnalyticsEvent}
          disableLeadCapture={isLeadDisabled}
        />
      </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-5 py-10 lg:py-8">
        {!embed ? (
          <Link
            to="/gallery"
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Volver a galería
          </Link>
        ) : null}

        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70">
          <PropertyHero property={property} primaryColor={primaryColor} />

          <div className="grid grid-cols-1 gap-8 p-7 md:p-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DetailStat label={t(lang, 'stat_price')} value={formatCurrency(property.price)} />
                <DetailStat label={t(lang, 'stat_area')} value={`${property.area} m²`} />
                <DetailStat label={t(lang, 'stat_rooms')} value={property.rooms} />
                <DetailStat label={t(lang, 'stat_bathrooms')} value={property.bathrooms} />
              </div>

              <section className="mt-8 rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200">
                <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>
                  Sobre esta propiedad
                </p>
                <p className="mt-4 leading-8 text-slate-600">{property.description}</p>
              </section>

              {/* ── Hero Video — renders only when heroVideoUrl is set ── */}
              <PropertyVideoHero
                videoUrl={property.heroVideoUrl ?? ''}
                posterUrl={property.heroVideoPoster || property.coverImage || undefined}
                className="mt-8"
              />

              {/* ── Trust strip: buyer signals before the viewer ──────── */}
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Sin descargar nada
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Pide info sin llamar
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  24/7 disponible
                </span>
              </div>
              {accessLevel === 'readonly' ? <ReadonlyBanner daysLeft={daysUntilBlock} /> : null}
              {!isDesktopImmersiveViewport ? (
              <div>
                <UniversalViewer
                  propertyId={property.id}
                  spaces={property.spaces}
                  primaryColor={primaryColor}
                  removeBranding={property.removeBranding}
                  language={lang}
                  propertyTitle={property.title}
                  agencyName={property.tenantLogoText || property.tenantName || 'Agencia inmobiliaria'}
                  agencyLogoUrl={property.tenantLogoUrl || undefined}
                  tenantWhatsapp={property.tenantWhatsapp}
                  tenantCalendlyUrl={property.tenantCalendlyUrl}
                  floorplanUrl={property.floorplanUrl || undefined}
                  guidedConfig={property.guidedConfig}
                  arEnabled={arEnabled}
                  className="mt-3"
                  onAnalyticsEvent={handleAnalyticsEvent}
                  disableLeadCapture={isLeadDisabled}
                />
              </div>
              ) : null}

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
                  <div className="flex items-center gap-2 text-sm font-black text-slate-500">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Sin ubicación — añade la dirección para mostrar el mapa
                  </div>
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

              {/* Room Designer proposal card — auth-only */}
              {isAuthenticated ? (
                <div className="mt-5 overflow-hidden rounded-[1.4rem] bg-white p-5 ring-1 ring-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: primaryColor }}>
                    Room Designer
                  </p>
                  <h3 className="mt-2 text-sm font-black text-slate-900">Propuesta visual</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Diseña una estancia amueblada con productos reales para esta propiedad y exporta una propuesta comercial.
                  </p>
                  <a
                    href={buildRoomDesignerUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M2 7l10-5 10 5-10 5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                    Crear propuesta visual
                  </a>
                  <p className="mt-2 text-center text-[10px] text-slate-400">
                    Se abrirá en una nueva pestaña con el contexto de esta propiedad.
                  </p>
                </div>
              ) : null}

              {/* Mortgage simulator — visible to all visitors, hidden when price = 0 */}
              <MortgageSimulator price={property.price} primaryColor={primaryColor} />

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
                  onClick={() => { if (!isLeadDisabled) setShowContactModal(true); }}
                  disabled={isLeadDisabled}
                  title={isLeadDisabled ? 'Contacto desactivado — suscripción expirada' : undefined}
                  className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isLeadDisabled ? 'Contacto no disponible' : 'Contactar agente'}
                </button>
              )}
              {/* Calendly booking button — only shown when tenant has a Calendly URL configured */}
              {property.tenantCalendlyUrl?.trim() ? (
                <a
                  href={property.tenantCalendlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: '#0069FF' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Reservar visita
                </a>
              ) : null}

              {/* Direct call button — only shown when the tenant has a phone number configured */}
              {property.tenantPhone?.replace(/\D/g, '').length ? (
                <a
                  href={`tel:${property.tenantPhone.replace(/\s/g, '')}`}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.1 6.1l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Llamar agente
                </a>
              ) : null}
              {/* ── Sección: Compartir ─────────────────────────────────── */}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Compartir</p>
                {!embed ? (
                  <button
                    type="button"
                    onClick={() => { setShowShareModal(true); trackShareEvent('native'); }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    {t(lang, 'share_btn')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  {linkCopied ? t(lang, 'share_link_copied') : t(lang, 'share_copy_link')}
                </button>
                {!embed ? (
                  <a
                    href={`${API_BASE}/properties/${property.id}/buyer-pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    Descargar ficha PDF
                  </a>
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
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  {t(lang, 'share_mobile_view')}
                </button>
              </div>

              {/* ── Sección: Herramientas agente (auth-only) ───────────── */}
              {isAuthenticated ? (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Herramientas agente</p>
                  <button
                    type="button"
                    onClick={() => { void handleDownloadTour(); }}
                    disabled={downloadingTour}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-5 py-3.5 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    {iframeCopied ? t(lang, 'share_iframe_copied') : t(lang, 'share_copy_iframe')}
                  </button>
                </div>
              ) : null}
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
