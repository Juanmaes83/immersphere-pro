import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useMatch, useSearchParams } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useLeadsBadge, markLeadsAsSeen } from '@/hooks/useLeadsBadge';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import PlanCard from '@/components/billing/PlanCard';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, type CreateAssetPayload, type CreatePropertyPayload, type CreateSpacePayload, type ImmersiveProperty } from '@/store/propertyStore';
import type { Hotspot, Space } from '@/types/viewer';
import ErrorBoundary from '@/components/ErrorBoundary';
import HelpPage from '@/pages/HelpPage';
const PanoramaViewer = lazy(() => import('@/components/viewer/PanoramaViewer'));
const PropertyDetailPage = lazy(() => import('@/pages/PropertyDetailPage'));
const TenantAnalyticsDashboard = lazy(() => import('@/pages/TenantAnalyticsDashboard'));
const GlbViewer = lazy(() => import('@/components/viewer/GlbViewer'));

interface SubscriptionResponse {
  tenantId: string;
  plan: string;
  subscription: {
    id: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    plan: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface TenantUsageResponse {
  plan: string;
  propertiesUsed: number;
  propertyLimit: number | null;
  remaining: number | null;
  canCreateMore: boolean;
}

interface StorageUsageResponse {
  plan: string;
  usedMb: number;
  limitMb: number | null;
  remainingMb: number | null;
  percentageUsed: number;
  isUnlimited: boolean;
}

interface LeadRecord {
  id: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  createdAt: string;
}

interface UploadAssetResponse {
  provider: string;
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  bytes: number;
  url: string;
  path: string;
  thumbnailUrl: string;
  resourceType: string;
  publicId: string | null;
  storageKey: string | null;
  width: number | null;
  height: number | null;
  format: string;
}

function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('theme', dark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);
  return [dark, toggle];
}

function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { bgStyle, colorStyle } = useBrand();
  const [dark, toggleDark] = useDarkMode();
  const { unreadCount } = useLeadsBadge(isAuthenticated);

  const logoText = user?.tenant.logoText ?? '✦';
  const logoUrl = user?.tenant.logoUrl ?? '';
  const brandName = user?.tenant.name ?? 'Immersphere';
  const brandSub = isAuthenticated ? (user?.tenant.plan ?? 'STARTER') : 'Pro SaaS';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-10 w-10 rounded-2xl object-cover" />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black text-white"
                style={bgStyle}
              >
                {logoText}
              </span>
            )}
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.24em]">{brandName}</span>
              <span className="block text-xs font-bold uppercase tracking-[0.2em]" style={colorStyle}>{brandSub}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            <BrandNavLink to="/gallery">Galería</BrandNavLink>
            {isAuthenticated ? (
              <>
                <BrandNavLink to="/dashboard">Dashboard</BrandNavLink>
                <BrandNavLink to="/properties">Propiedades</BrandNavLink>
                <div className="relative">
                  <BrandNavLink to="/leads">Leads</BrandNavLink>
                  {unreadCount > 0 ? (
                    <span className="pointer-events-none absolute -right-1 -top-0.5 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </div>
                <BrandNavLink to="/settings">Planes</BrandNavLink>
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/ayuda"
              title="Ayuda y guía rápida"
              aria-label="Ayuda"
              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              ?
            </Link>
            <button
              type="button"
              onClick={toggleDark}
              title={dark ? 'Modo claro' : 'Modo oscuro'}
              className="rounded-full border border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {isAuthenticated ? (
              <>
                <span
                  className="hidden rounded-full px-4 py-2 text-xs font-black text-white md:inline-flex"
                  style={bgStyle}
                >
                  {user?.tenant.name ?? 'Tenant'} · {user?.tenant.plan ?? 'STARTER'}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="rounded-full px-5 py-2 text-sm font-black text-white transition hover:opacity-90"
                  style={bgStyle}
                >
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 sm:flex-row">
          <p className="text-xs font-bold text-slate-400">
            Powered by <span className="font-black text-slate-600 dark:text-slate-300">Immersphere Pro</span>
            <span className="mx-2 text-slate-200 dark:text-slate-700">·</span>
            <Link to="/ayuda" className="font-black text-slate-500 hover:underline dark:text-slate-400">Ayuda</Link>
          </p>
          <p className="text-xs font-bold text-slate-400">
            Idea by <span className="font-black text-slate-700 dark:text-slate-300">Rubik Sota</span>
            <a href="tel:+34629554870" className="ml-2 font-black text-slate-700 hover:underline dark:text-slate-300">629 554 870</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function BrandNavLink({ to, children }: { to: string; children: React.ReactNode }): JSX.Element {
  const match = useMatch(to);
  const { colorStyle } = useBrand();
  return (
    <Link
      to={to}
      className="rounded-full px-4 py-2 text-sm font-black transition hover:bg-slate-100 hover:text-slate-950"
      style={match ? { ...colorStyle, backgroundColor: 'color-mix(in srgb, var(--brand) 10%, transparent)' } : undefined}
    >
      {children}
    </Link>
  );
}

function LandingPage(): JSX.Element {
  return (
    <main className="bg-[#050712] text-white">
      <Helmet>
        <title>Immersphere Pro · Tours inmersivos para inmobiliarias</title>
        <meta name="description" content="Plataforma SaaS de tours virtuales 360° y Gaussian Splats para inmobiliarias, constructoras y decoradores. White label, analytics y leads integrados." />
      </Helmet>
      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl grid-cols-1 gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">SaaS inmersivo B2B</p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
            Convierte espacios en decisiones de compra.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">
            Plataforma multi-tenant con 360°, Gaussian Splats, white label, analytics comercial y suscripciones Stripe.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link to="/register" className="rounded-full bg-white px-7 py-4 text-center text-sm font-black text-slate-950 hover:bg-cyan-300">
              Crear tenant demo
            </Link>
            <Link to="/gallery" className="rounded-full border border-white/15 px-7 py-4 text-center text-sm font-black text-white hover:bg-white/10">
              Ver galería
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-violet-950/30">
          <div className="rounded-[1.6rem] bg-gradient-to-br from-cyan-500/20 via-violet-700/20 to-slate-950 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Fase 5.3</p>
            <h2 className="mt-5 text-4xl font-black">Frontend conectado a backend real.</h2>
            <div className="mt-10 grid grid-cols-2 gap-3">
              {['JWT', 'API real', 'Stripe', 'Deploy'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/25 p-4 font-black">
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginPage(): JSX.Element {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
      <Helmet>
        <title>Entrar · Immersphere Pro</title>
        <meta name="description" content="Accede a tu cuenta de Immersphere Pro para gestionar tus propiedades y tours virtuales." />
      </Helmet>
      <LoginForm />
    </main>
  );
}

function RegisterPage(): JSX.Element {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
      <Helmet>
        <title>Crear cuenta · Immersphere Pro</title>
        <meta name="description" content="Crea tu tenant en Immersphere Pro y empieza a publicar tours virtuales inmersivos para tus propiedades." />
      </Helmet>
      <RegisterForm />
    </main>
  );
}

const HELP_BANNER_KEY = 'immersphere_help_banner_dismissed';

interface DashLead {
  id: string;
  propertyId: string;
  propertyTitle: string;
  email: string;
  status: string;
  nextActionAt: string | null;
  createdAt: string;
}

function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { properties, fetchProperties, isLoading } = usePropertyStore();
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelpBanner, setShowHelpBanner] = useState<boolean>(
    () => !localStorage.getItem(HELP_BANNER_KEY)
  );
  const [dashLeads, setDashLeads] = useState<DashLead[]>([]);
  const [dashLeadsLoading, setDashLeadsLoading] = useState(true);

  useEffect(() => {
    void fetchProperties({ limit: 100 });
    void loadBillingState();
    void loadDashLeads();
  }, [fetchProperties]);

  async function loadBillingState(): Promise<void> {
    try {
      const sub = await unwrapApiResponse<SubscriptionResponse>(api.get('/subscriptions/current'));
      setSubscription(sub);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  async function loadDashLeads(): Promise<void> {
    try {
      const data = await unwrapApiResponse<DashLead[]>(api.get('/leads'));
      setDashLeads(Array.isArray(data) ? data : []);
    } catch { /* silent — metrics show fallback state */ }
    finally { setDashLeadsLoading(false); }
  }

  const metrics = useMemo(() => {
    const now = new Date();
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);
    const weekLeads = dashLeads.filter((l) => new Date(l.createdAt) >= weekStart);
    const pendingToday = dashLeads.filter((l) =>
      l.nextActionAt && new Date(l.nextActionAt) <= todayEnd && !DONE_STATUSES.has(l.status)
    );
    const activeProps = properties.filter((p) => p.status === 'PUBLISHED');
    const topByContacts = [...properties].sort((a, b) => b.leads - a.leads).find((p) => p.leads > 0) ?? null;
    const recentLeads = [...dashLeads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    return { weekLeads, pendingToday, activeProps, topByContacts, recentLeads };
  }, [dashLeads, properties]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>Dashboard · {user?.tenant.name ?? 'Immersphere Pro'}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* ── Page header ── */}
      <div>
        <p className="text-ip-xs font-semibold uppercase tracking-[0.22em] text-ip-accent">
          {user?.tenant.name ?? 'Immersphere Pro'}
        </p>
        <h1 className="mt-2 text-ip-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {user?.name ? `Hola, ${user.name.split(' ')[0]}` : 'Dashboard'}
        </h1>
      </div>

      {/* ── Help banner ── */}
      {showHelpBanner && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-ip-card bg-violet-50 px-5 py-4 ring-1 ring-violet-200 dark:bg-ip-card dark:ring-ip-card-border">
          <p className="text-ip-sm font-semibold text-slate-600 dark:text-white/50">
            Primera vez?{' '}
            <Link
              to="/ayuda"
              className="font-bold text-ip-accent underline underline-offset-2 hover:text-ip-accent-hover"
            >
              Visita la guía rápida →
            </Link>
          </p>
          <button
            type="button"
            aria-label="Cerrar banner"
            onClick={() => { localStorage.setItem(HELP_BANNER_KEY, '1'); setShowHelpBanner(false); }}
            className="shrink-0 text-slate-400 transition hover:text-slate-600 dark:text-white/25 dark:hover:text-white/60"
          >
            ✕
          </button>
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-ip-card bg-ip-danger/10 px-5 py-4 text-ip-sm font-semibold text-ip-danger ring-1 ring-ip-danger/20">
          {error}
        </div>
      ) : null}

      {/* ── Hero summary ── */}
      <div className="mt-5 flex flex-col gap-5 rounded-ip-panel bg-white px-7 py-6 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ip-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-white/35">
            Resumen del día
          </p>
          <p className="mt-2 max-w-lg text-ip-lg font-semibold leading-snug text-slate-900 dark:text-white">
            {dashLeadsLoading ? (
              <span className="text-slate-400 dark:text-white/25">Calculando resumen...</span>
            ) : (
              <>
                Hoy tienes{' '}
                <span className={metrics.pendingToday.length > 0 ? 'text-ip-warning' : 'text-slate-900 dark:text-white'}>
                  {metrics.pendingToday.length}{' '}
                  {metrics.pendingToday.length === 1 ? 'seguimiento pendiente' : 'seguimientos pendientes'}
                </span>
                {' '}y{' '}
                <span className="text-ip-accent">
                  {metrics.weekLeads.length}{' '}
                  {metrics.weekLeads.length === 1 ? 'nuevo interesado' : 'nuevos interesados'}
                </span>
                {' '}esta semana.
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/leads')}
          className="shrink-0 rounded-ip-pill bg-ip-accent px-5 py-2.5 text-ip-sm font-semibold text-white transition duration-ip-base ease-ip-base hover:bg-ip-accent-hover focus:outline-none"
        >
          Ver interesados →
        </button>
      </div>

      {/* ── Metric cards ── */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <CommercialCard
          label="Interesados esta semana"
          value={dashLeadsLoading ? '…' : metrics.weekLeads.length}
          sub="Últimos 7 días"
          loading={dashLeadsLoading}
        />
        <CommercialCard
          label="Seguimientos para hoy"
          value={dashLeadsLoading ? '…' : metrics.pendingToday.length}
          sub={metrics.pendingToday.length > 0 ? 'Requieren atención' : 'Al día'}
          accent={!dashLeadsLoading && metrics.pendingToday.length > 0}
          loading={dashLeadsLoading}
        />
        <CommercialCard
          label="Propiedades activas"
          value={isLoading ? '…' : metrics.activeProps.length}
          sub="Tours publicados"
          loading={isLoading}
        />
        <CommercialCard
          label="Mayor actividad"
          value={isLoading ? '…' : (metrics.topByContacts ? metrics.topByContacts.leads : '—')}
          sub={
            isLoading ? '' :
            metrics.topByContacts
              ? metrics.topByContacts.title
              : 'Sin contactos aún'
          }
          loading={isLoading}
        />
        <CommercialCard
          label="Propiedad más vista"
          value="—"
          sub="Sin datos suficientes"
          dim
        />
        <CommercialCard
          label="Conversión visita → contacto"
          value="—"
          sub="Sin datos suficientes"
          dim
        />
      </div>

      {/* ── Actividad reciente ── */}
      <div className="mt-4 rounded-ip-card bg-white px-5 py-5 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-ip-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-white/35">
            Actividad reciente
          </p>
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="text-ip-xs font-semibold text-ip-accent transition hover:text-ip-accent-hover"
          >
            Ver todos →
          </button>
        </div>
        {dashLeadsLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-200 dark:bg-white/5" />
            ))}
          </div>
        ) : metrics.recentLeads.length === 0 ? (
          <EmptyState
            icon={IcoInbox}
            title="Sin actividad reciente"
            body="Los interesados que lleguen desde tus tours aparecerán aquí."
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {metrics.recentLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ip-sm font-semibold text-slate-900 dark:text-white">{l.email}</p>
                  <p className="truncate text-ip-xs text-slate-500 dark:text-white/35">
                    {l.propertyTitle || l.propertyId.slice(0, 8)}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-ip-xs text-slate-400 dark:text-white/25">
                  {new Date(l.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Billing strip ── */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-ip-pill bg-slate-100 px-4 py-1.5 text-ip-xs font-semibold text-slate-500 dark:bg-white/5 dark:text-white/35">
          Plan:{' '}
          <span className="text-slate-700 dark:text-white/55">{subscription?.plan ?? user?.tenant.plan ?? 'STARTER'}</span>
        </span>
        <span className="rounded-ip-pill bg-slate-100 px-4 py-1.5 text-ip-xs font-semibold text-slate-500 dark:bg-white/5 dark:text-white/35">
          {isLoading
            ? '…'
            : `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} en cartera`}
        </span>
      </div>
    </main>
  );
}

function CommercialCard({
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

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <article className="rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950 dark:text-slate-100">{value}</p>
    </article>
  );
}

function GalleryPage(): JSX.Element {
  const navigate = useNavigate();
  const { properties, fetchProperties, isLoading, error } = usePropertyStore();
  const [query, setQuery] = useState('');
  const [topIds, setTopIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  useEffect(() => {
    void fetchProperties({ status: 'PUBLISHED' });
    api.get('/properties/stats')
      .then((res) => {
        const items = (res.data as { data: PropertyStatItem[] }).data ?? [];
        setTopIds(new Set(items.filter((p) => p.views > 0).map((p) => p.id)));
      })
      .catch(() => {});
  }, [fetchProperties]);

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return properties;
    return properties.filter((property) => `${property.title} ${property.description}`.toLowerCase().includes(normalizedQuery));
  }, [properties, query]);

  function toggleCompareSelection(id: string): void {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const { colorStyle, bgStyle } = useBrand();

  return (
    <main className={`mx-auto max-w-7xl px-5 py-10 ${compareMode && selectedForCompare.length > 0 ? 'pb-28' : ''}`}>
      <Helmet>
        <title>Galería de propiedades · Immersphere Pro</title>
        <meta name="description" content="Explora propiedades con tours virtuales inmersivos en 360° y Gaussian Splats. Visita los espacios como si estuvieras allí." />
      </Helmet>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Galería pública</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades publicadas</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar propiedad"
            className="brand-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 md:w-72"
          />
          <button
            type="button"
            onClick={() => { setCompareMode((prev) => !prev); setSelectedForCompare([]); }}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              compareMode
                ? 'bg-violet-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
            }`}
          >
            {compareMode ? '✕ Cancelar' : '⊞ Comparar'}
          </button>
        </div>
      </div>

      {compareMode && (
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Selecciona 2 o 3 propiedades para comparar. {selectedForCompare.length}/3 seleccionadas.
        </p>
      )}

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      {isLoading ? <p className="mt-8 font-bold text-slate-500 dark:text-slate-400">Cargando propiedades...</p> : null}

      {topIds.size > 0 && !query && !compareMode ? (
        <div className="mt-8">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-amber-600">🔥 Más vistas</p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.filter((p) => topIds.has(p.id)).slice(0, 3).map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onOpen={() => navigate(`/property/${property.id}`)}
                hotBadge
                compareMode={compareMode}
                isSelectedForCompare={selectedForCompare.includes(property.id)}
                onToggleCompare={toggleCompareSelection}
              />
            ))}
          </div>
          <p className="mt-8 mb-4 text-sm font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Todas las propiedades</p>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProperties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onOpen={() => navigate(`/property/${property.id}`)}
            hotBadge={!compareMode && topIds.has(property.id)}
            compareMode={compareMode}
            isSelectedForCompare={selectedForCompare.includes(property.id)}
            onToggleCompare={toggleCompareSelection}
          />
        ))}
      </div>

      {/* Compare bottom bar */}
      {compareMode && selectedForCompare.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 py-4 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5">
            <p className="font-black dark:text-white">
              {selectedForCompare.length} propiedad{selectedForCompare.length !== 1 ? 'es' : ''} seleccionada{selectedForCompare.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/compare?ids=${selectedForCompare.join(',')}`)}
              disabled={selectedForCompare.length < 2}
              className="rounded-full px-6 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
              style={bgStyle}
            >
              Ver comparación →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function PropertyCard({
  property,
  onOpen,
  hotBadge,
  compareMode,
  isSelectedForCompare,
  onToggleCompare
}: {
  property: ImmersiveProperty;
  onOpen: () => void;
  hotBadge?: boolean;
  compareMode?: boolean;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (id: string) => void;
}): JSX.Element {
  const { bgStyle, colorStyle } = useBrand();
  const thumb = property.thumbnailUrl;
  return (
    <article className="overflow-hidden rounded-[1.7rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl dark:bg-slate-800 dark:ring-slate-700">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
          {thumb ? (
            <img src={thumb} alt={property.title} className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white opacity-60" style={bgStyle}>
                ✦
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Sin imagen</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {compareMode ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCompare?.(property.id); }}
              className={`absolute left-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 backdrop-blur transition ${
                isSelectedForCompare
                  ? 'border-violet-400 bg-violet-600 text-white'
                  : 'border-white/70 bg-black/40 text-white/50 hover:border-white hover:bg-black/60'
              }`}
            >
              {isSelectedForCompare ? '✓' : ''}
            </button>
          ) : hotBadge ? (
            <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">
              🔥 Más vistas
            </span>
          ) : null}
          {property.isPasswordProtected ? (
            <span className="absolute right-4 top-4 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
              🔒 Protegido
            </span>
          ) : null}
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="text-2xl font-black leading-tight">{property.title}</h3>
            <p className="mt-1 text-sm font-semibold text-white/75">{property.area} m² · {property.rooms} hab.</p>
          </div>
        </div>
      </button>
      <div className="p-5">
        <p className="text-xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(property.price)}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{property.description}</p>
        {property.address ? <p className="mt-2 text-xs font-semibold" style={colorStyle}>📍 {property.address}</p> : null}
        <button type="button" onClick={onOpen} className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
          Abrir ficha inmersiva
        </button>
      </div>
    </article>
  );
}

interface PropertyStatItem {
  id: string;
  title: string;
  coverImage: string;
  type: string;
  price: number;
  area: number;
  rooms: number;
  views: number;
}

interface PublicProperty {
  id: string;
  title: string;
  description: string;
  type: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  coverImage: string;
  address: string;
}

interface PublicTenantProfile {
  name: string;
  slug: string;
  logoText: string;
  logoUrl: string;
  primaryColor: string;
  properties: PublicProperty[];
}

function AgencyPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicTenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    api.get(`/tenants/public/${slug}`)
      .then((res) => {
        const data = (res.data as { success: boolean; data: PublicTenantProfile }).data;
        setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-20 text-center">
        <p className="font-bold text-slate-500">Cargando perfil de agencia...</p>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-4xl font-black">Agencia no encontrada</h1>
        <button type="button" onClick={() => navigate('/gallery')} className="mt-8 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white">
          Ver galería
        </button>
      </main>
    );
  }

  const primaryColor = profile.primaryColor || '#7C3AED';

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>{profile.name} · Propiedades en Immersphere Pro</title>
        <meta name="description" content={`Explora las propiedades publicadas por ${profile.name} con tours virtuales inmersivos.`} />
      </Helmet>

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white md:p-12">
        <div className="flex items-center gap-5">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt={profile.name} className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-black text-white" style={{ backgroundColor: primaryColor }}>
              {profile.logoText || profile.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: primaryColor }}>Agencia</p>
            <h1 className="mt-1 text-4xl font-black tracking-tight">{profile.name}</h1>
            <p className="mt-1 text-sm text-white/50">{profile.properties.length} {profile.properties.length === 1 ? 'propiedad publicada' : 'propiedades publicadas'}</p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {profile.properties.map((property) => (
          <article key={property.id} className="overflow-hidden rounded-[1.7rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl">
            <button type="button" onClick={() => navigate(`/property/${property.id}`)} className="block w-full text-left">
              <div className="relative aspect-[4/3] bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
                {property.coverImage ? <img src={property.coverImage} alt={property.title} className="h-full w-full object-cover" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="text-xl font-black leading-tight">{property.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-white/75">{property.area} m² · {property.rooms} hab.</p>
                </div>
              </div>
            </button>
            <div className="p-5">
              <p className="text-xl font-black text-slate-950">{formatCurrency(property.price)}</p>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{property.description}</p>
              {property.address ? <p className="mt-2 text-xs font-semibold text-slate-400">📍 {property.address}</p> : null}
              <button type="button" onClick={() => navigate(`/property/${property.id}`)} className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={{ backgroundColor: primaryColor }}>
                Ver tour inmersivo
              </button>
            </div>
          </article>
        ))}
      </div>

      {profile.properties.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-slate-500">Esta agencia no tiene propiedades publicadas todavía.</p>
        </div>
      ) : null}
    </main>
  );
}

function PropertyRoutePage(): JSX.Element {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/gallery" replace />;
  }

  return (
    <ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Error al cargar la propiedad.</div>}>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
        <PropertyDetailPage propertyId={id} />
      </Suspense>
    </ErrorBoundary>
  );
}

function EmbedRoutePage(): JSX.Element {
  const { id } = useParams();

  if (!id) {
    return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Tour no encontrado.</div>;
  }

  return (
    <ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Error al cargar el tour.</div>}>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
        <div className="bg-[#F8FAFC] text-slate-950">
          <PropertyDetailPage propertyId={id} embed />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────
function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
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

// Inline Lucide-style SVG icons (no extra dependency)
const IcoInbox = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);
const IcoSearchX = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <path d="m8 8 6 6" />
    <path d="m14 8-6 6" />
  </svg>
);
const IcoBuilding = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v8h4" />
    <path d="M18 9h2a2 2 0 0 1 2 2v11h-4" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </svg>
);
const IcoCheckCircle = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
// Quick-action icons (h-5 w-5, used in property card footer)
const IcoLink = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IcoWhatsApp = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.04-8.63A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.5 6.5l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IcoCode = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);
const IcoFilePdf = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);
const IcoUsers = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IcoCheckSm = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
// ──────────────────────────────────────────────────────────────────────────

function PropertiesPage(): JSX.Element {
  const navigate = useNavigate();
  const {
    properties,
    fetchProperties,
    createProperty,
    updateProperty,
    deleteProperty,
    createSpace,
    updateSpace,
    deleteSpace,
    createAsset,
    updateAsset,
    deleteAsset,
    isLoading,
    error
  } = usePropertyStore();

  const [form, setForm] = useState<CreatePropertyPayload>({
    title: '',
    description: '',
    type: 'APARTMENT',
    status: 'DRAFT',
    price: 0,
    area: 80,
    rooms: 2,
    bathrooms: 1,
    coverImage: '',
    panoramaUrl: '',
    address: '',
    latitude: null,
    longitude: null,
    password: ''
  });

  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [editingSpace, setEditingSpace] = useState<{ propertyId: string; spaceId: string } | null>(null);
  const [editingAsset, setEditingAsset] = useState<{ propertyId: string; spaceId: string; assetId: string } | null>(null);
  const [activeAssetFormTarget, setActiveAssetFormTarget] = useState<{ propertyId: string; spaceId: string } | null>(null);
  const [spaceForm, setSpaceForm] = useState<CreateSpacePayload>({
    name: '',
    order: 1,
    status: 'ACTIVE',
    dimensions: { width: null, height: null, depth: null }
  });
  const [assetForm, setAssetForm] = useState<CreateAssetPayload>({
    type: 'panorama_360',
    url: '',
    thumbnail: '',
    format: 'jpg',
    size: 0,
    hotspots: []
  });
  const [selectedAssetFileName, setSelectedAssetFileName] = useState<string | null>(null);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [leadsPropertyId, setLeadsPropertyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [showHotspotForm, setShowHotspotForm] = useState(false);
  const [hotspotDraft, setHotspotDraft] = useState<{ label: string; type: Hotspot['type']; x: number; y: number; body: string; metric: string; targetSpaceId: string }>({
    label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: ''
  });
  const { bgStyle, colorStyle } = useBrand();

  const [copiedPropId, setCopiedPropId] = useState<string>('');
  const [copiedPropType, setCopiedPropType] = useState<string>('');
  // Visual hotspot editor: -1 = dragging draft pin, 0+ = dragging existing hotspot
  const [draggingHotspotIdx, setDraggingHotspotIdx] = useState<number | null>(null);
  const hotspotPreviewRef = useRef<HTMLDivElement>(null);

  function handleCopyProp(id: string, type: string, text: string): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedPropId(id);
      setCopiedPropType(type);
      setTimeout(() => { setCopiedPropId(''); setCopiedPropType(''); }, 1800);
    });
  }

  useEffect(() => {
    void fetchProperties({ limit: 100 });
  }, [fetchProperties]);

  function resetForm(): void {
    setForm({
      title: '',
      description: '',
      type: 'APARTMENT',
      status: 'DRAFT',
      price: 0,
      area: 80,
      rooms: 2,
      bathrooms: 1,
      coverImage: '',
      panoramaUrl: '',
      address: '',
      latitude: null,
      longitude: null,
      password: ''
    });

    setEditingPropertyId(null);
    setMessage(null);
  }

  function getNextSpaceOrder(propertyId: string): number {
    const property = properties.find((item) => item.id === propertyId);
    const orders = (property?.spaces ?? []).map((space) => Number(space.order ?? 0));
    const maxOrder = orders.length > 0 ? Math.max(...orders) : 0;

    return maxOrder + 1;
  }

  function resetSpaceForm(propertyId?: string): void {
    setSpaceForm({
      name: '',
      order: propertyId ? getNextSpaceOrder(propertyId) : 1,
      status: 'ACTIVE',
      dimensions: { width: null, height: null, depth: null }
    });
    setEditingSpace(null);
  }

  function getDefaultAssetForm(): CreateAssetPayload {
    return {
      type: 'panorama_360',
      url: '',
      thumbnail: '',
      format: 'jpg',
      size: 0,
      hotspots: []
    };
  }

  function resetAssetForm(): void {
    setAssetForm(getDefaultAssetForm());
    setEditingAsset(null);
    setSelectedAssetFileName(null);
    setShowHotspotForm(false);
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
  }

  function closeAssetForm(): void {
    resetAssetForm();
    setActiveAssetFormTarget(null);
  }

  function getDefaultAssetFormat(type: CreateAssetPayload['type']): CreateAssetPayload['format'] {
    if (type === 'gaussian_splat') return 'splat';
    if (type === 'mesh') return 'glb';

    return 'jpg';
  }

  function handleAssetTypeChange(type: CreateAssetPayload['type']): void {
    setAssetForm((current) => ({
      ...current,
      type,
      format: getDefaultAssetFormat(type)
    }));
  }

  function isFallbackAssetId(assetId: string): boolean {
    return assetId.endsWith('-fallback-panorama');
  }

  function getUploadedAssetFormat(filename: string, serverFormat: string): CreateAssetPayload['format'] {
    const ext = (serverFormat || filename.split('.').pop() || '').toLowerCase();
    const allowed: CreateAssetPayload['format'][] = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];
    return allowed.includes(ext as CreateAssetPayload['format']) ? (ext as CreateAssetPayload['format']) : 'jpg';
  }

  function getUploadedAssetType(filename: string): CreateAssetPayload['type'] {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'glb') return 'mesh';
    if (ext === 'splat' || ext === 'ply') return 'gaussian_splat';
    return 'panorama_360';
  }

  function getUploadSizeMb(bytes: number, fallbackSize: number, fileSize: number): number {
    const raw = bytes || fallbackSize || fileSize || 0;
    return Math.round((raw / (1024 * 1024)) * 100) / 100;
  }

  async function processAssetFile(file: File): Promise<void> {
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!allowedExtensions.includes(ext)) {
      setMessage('Formato no permitido. Usa JPG, JPEG, PNG, WEBP, SPLAT, PLY o GLB.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setMessage('El archivo supera el limite de 100 MB.');
      return;
    }

    setIsUploadingAsset(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      );

      const detectedFormat = getUploadedAssetFormat(file.name, upload.format);
      const detectedType = getUploadedAssetType(file.name);
      const sizeMb = getUploadSizeMb(upload.bytes, upload.size, file.size);

      setAssetForm((current) => ({
        ...current,
        url: upload.url,
        thumbnail: upload.thumbnailUrl || current.thumbnail || '',
        format: detectedFormat,
        type: detectedType,
        size: sizeMb
      }));

      setSelectedAssetFileName(upload.originalName || file.name);
      setMessage('Archivo subido correctamente. Revisa y guarda el asset.');
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setIsUploadingAsset(false);
    }
  }

  async function handleAssetFileUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processAssetFile(file);
  }

  async function handleViewLeads(propertyId: string): Promise<void> {
    if (leadsPropertyId === propertyId) {
      setLeadsPropertyId(null);
      setLeads([]);
      return;
    }
    setLeadsPropertyId(propertyId);
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const data = await unwrapApiResponse<LeadRecord[]>(api.get(`/leads/properties/${propertyId}`));
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setLeadsError(getApiErrorMessage(err));
    } finally {
      setLeadsLoading(false);
    }
  }

  async function handleExportLeadsCsv(propertyId: string, title: string): Promise<void> {
    try {
      const response = await api.get(`/leads/properties/${propertyId}/export.csv`, { responseType: 'text' });
      const blob = new Blob([response.data as string], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `leads-${title.replace(/\s+/g, '-').toLowerCase()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage('No se pudo exportar los leads.');
    }
  }

  function handleAddHotspot(): void {
    if (!hotspotDraft.label.trim()) return;
    if (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId) return;
    const newHotspot: Hotspot = {
      id: `draft-${Date.now()}`,
      label: hotspotDraft.label.trim(),
      type: hotspotDraft.type,
      position: { x: hotspotDraft.x, y: hotspotDraft.y },
      body: hotspotDraft.body.trim(),
      metric: hotspotDraft.metric.trim(),
      ...(hotspotDraft.targetSpaceId ? { targetSpaceId: hotspotDraft.targetSpaceId } : {})
    };
    setAssetForm((current) => ({ ...current, hotspots: [...(current.hotspots ?? []), newHotspot] }));
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
    setShowHotspotForm(false);
  }

  function handleRemoveHotspot(index: number): void {
    setAssetForm((current) => ({
      ...current,
      hotspots: (current.hotspots ?? []).filter((_, i) => i !== index)
    }));
  }

  function buildPayload(): CreatePropertyPayload {
    return {
      title: String(form.title ?? '').trim(),
      description: String(form.description ?? '').trim(),
      type: String(form.type ?? 'APARTMENT'),
      status: String(form.status ?? 'DRAFT'),
      price: Number(form.price ?? 0),
      area: Number(form.area ?? 0),
      rooms: Number(form.rooms ?? 0),
      bathrooms: Number(form.bathrooms ?? 0),
      coverImage: String(form.coverImage ?? '').trim(),
      panoramaUrl: String(form.panoramaUrl ?? '').trim(),
      address: String(form.address ?? '').trim(),
      latitude: form.latitude ?? null,
      longitude: form.longitude ?? null,
      ...(form.password ? { password: form.password } : {})
    };
  }

  function handleEditProperty(property: any): void {
    setEditingPropertyId(property.id);

    setForm({
      title: property.title ?? '',
      description: property.description ?? '',
      type: property.type ?? 'APARTMENT',
      status: property.status ?? 'DRAFT',
      price: property.price ?? 0,
      area: property.area ?? 80,
      rooms: property.rooms ?? 0,
      bathrooms: property.bathrooms ?? 0,
      coverImage: property.coverImage ?? '',
      panoramaUrl: property.panoramaUrl ?? '',
      address: property.address ?? '',
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null
    });

    setMessage('Editando propiedad seleccionada.');
  }

  async function handleSubmit(event: any): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const payload = buildPayload();

    if (payload.title.length < 2) {
      setMessage('El titulo debe tener al menos 2 caracteres.');
      return;
    }

    if ((payload.area ?? 0) <= 0) {
      setMessage('La superficie debe ser mayor que 0 m2.');
      return;
    }

    try {
      if (editingPropertyId) {
        await updateProperty(editingPropertyId, payload);
        setMessage('Propiedad actualizada correctamente.');
      } else {
        await createProperty(payload);
        setMessage('Propiedad creada correctamente.');
      }

      resetForm();
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido guardar la propiedad.');
    }
  }

  async function handleTogglePublish(property: any): Promise<void> {
    const nextStatus = property.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';

    try {
      await updateProperty(property.id, {
        title: property.title,
        description: property.description,
        type: property.type,
        status: nextStatus,
        price: property.price,
        area: property.area,
        rooms: property.rooms,
        bathrooms: property.bathrooms,
        coverImage: property.coverImage,
        panoramaUrl: property.panoramaUrl,
        address: property.address ?? '',
        latitude: property.latitude ?? null,
        longitude: property.longitude ?? null
      });

      setMessage(
        nextStatus === 'PUBLISHED'
          ? 'Propiedad publicada. Ya aparece en Galeria.'
          : 'Propiedad despublicada. Ya no aparece en Galeria.'
      );

      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido cambiar el estado de publicacion.');
    }
  }

  async function handleDeleteProperty(propertyId: string): Promise<void> {
    try {
      await deleteProperty(propertyId);

      if (editingPropertyId === propertyId) {
        resetForm();
      }

      setMessage('Propiedad eliminada correctamente.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido eliminar la propiedad.');
    }
  }

  function handleOpenSpaces(property: ImmersiveProperty): void {
    const nextIsOpen = expandedPropertyId !== property.id;
    setExpandedPropertyId(nextIsOpen ? property.id : null);
    setEditingSpace(null);

    setSpaceForm({
      name: '',
      order: (property.spaces?.length ?? 0) + 1,
      status: 'ACTIVE',
      dimensions: { width: null, height: null, depth: null }
    });

    if (nextIsOpen) {
      setMessage('Gestionando estancias de ' + property.title + '.');
    }
  }

  function handleEditSpace(propertyId: string, space: ImmersiveProperty['spaces'][number]): void {
    setExpandedPropertyId(propertyId);
    setEditingSpace({ propertyId, spaceId: space.id });

    setSpaceForm({
      name: space.name,
      order: space.order,
      status: space.status,
      dimensions: space.dimensions ?? { width: null, height: null, depth: null }
    });

    setMessage('Editando estancia seleccionada.');
  }

  async function handleSubmitSpace(event: any, propertyId: string): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const payload: CreateSpacePayload = {
      name: String(spaceForm.name ?? '').trim(),
      order: Math.max(1, Number(spaceForm.order ?? 1)),
      status: spaceForm.status === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE',
      dimensions: spaceForm.dimensions ?? { width: null, height: null, depth: null }
    };

    if (payload.name.length < 1) {
      setMessage('La estancia necesita nombre.');
      return;
    }

    try {
      if (editingSpace && editingSpace.propertyId === propertyId) {
        await updateSpace(propertyId, editingSpace.spaceId, payload);
        setMessage('Estancia actualizada correctamente.');
      } else {
        await createSpace(propertyId, payload);
        setMessage('Estancia creada correctamente.');
      }

      resetSpaceForm(propertyId);
      setExpandedPropertyId(propertyId);
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido guardar la estancia.');
    }
  }

  async function handleToggleSpaceStatus(propertyId: string, space: ImmersiveProperty['spaces'][number]): Promise<void> {
    const nextStatus = space.status === 'HIDDEN' ? 'ACTIVE' : 'HIDDEN';

    try {
      await updateSpace(propertyId, space.id, { status: nextStatus });
      setMessage(nextStatus === 'HIDDEN' ? 'Estancia ocultada.' : 'Estancia activada.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido cambiar el estado de la estancia.');
    }
  }

  async function handleDeleteSpace(propertyId: string, spaceId: string): Promise<void> {
    try {
      await deleteSpace(propertyId, spaceId);

      if (editingSpace?.spaceId === spaceId) {
        resetSpaceForm(propertyId);
      }

      setExpandedPropertyId(propertyId);
      setMessage('Estancia eliminada correctamente.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido eliminar la estancia.');
    }
  }

  function handleOpenAssetForm(propertyId: string, spaceId: string): void {
    setActiveAssetFormTarget({ propertyId, spaceId });
    setEditingAsset(null);
    setAssetForm(getDefaultAssetForm());
    setMessage('Preparando nuevo asset para la estancia.');
  }

  function handleEditAsset(
    propertyId: string,
    spaceId: string,
    asset: ImmersiveProperty['spaces'][number]['assets'][number]
  ): void {
    setActiveAssetFormTarget({ propertyId, spaceId });

    if (isFallbackAssetId(asset.id)) {
      setEditingAsset(null);
      setAssetForm(getDefaultAssetForm());
      setMessage('Este asset es demo temporal. Crea un asset real para sustituirlo.');
      return;
    }

    setEditingAsset({ propertyId, spaceId, assetId: asset.id });
    setAssetForm({
      type: asset.type,
      url: asset.url,
      thumbnail: asset.thumbnail ?? '',
      format: asset.format,
      size: asset.size ?? 0,
      hotspots: asset.hotspots ?? []
    });
    setMessage('Editando asset seleccionado.');
  }

  async function handleSubmitAsset(event: any, propertyId: string, spaceId: string): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const payload: CreateAssetPayload = {
      type: assetForm.type,
      url: String(assetForm.url ?? '').trim(),
      thumbnail: String(assetForm.thumbnail ?? '').trim(),
      format: assetForm.format,
      size: Math.round(Math.max(0, Number(assetForm.size ?? 0))),
      hotspots: assetForm.hotspots ?? []
    };

    if (payload.url.length < 1) {
      setMessage('El asset necesita una URL.');
      return;
    }

    try {
      if (editingAsset && editingAsset.propertyId === propertyId && editingAsset.spaceId === spaceId) {
        await updateAsset(propertyId, spaceId, editingAsset.assetId, payload);
        setMessage('Asset actualizado correctamente.');
      } else {
        await createAsset(propertyId, spaceId, payload);
        setMessage('Asset creado correctamente.');
      }

      closeAssetForm();
      setExpandedPropertyId(propertyId);
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido guardar el asset.');
    }
  }

  async function handleDeleteAsset(propertyId: string, spaceId: string, assetId: string): Promise<void> {
    if (isFallbackAssetId(assetId)) {
      setMessage('No se puede eliminar el asset demo temporal. Crea un asset real para sustituirlo.');
      return;
    }

    try {
      await deleteAsset(propertyId, spaceId, assetId);

      if (editingAsset?.assetId === assetId) {
        closeAssetForm();
      }

      setExpandedPropertyId(propertyId);
      setMessage('Asset eliminado correctamente.');
      await fetchProperties({ limit: 100 });
    } catch {
      setMessage('No se ha podido eliminar el asset.');
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Property Manager</p>
      <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.8rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black">{editingPropertyId ? 'Editar propiedad' : 'Nueva propiedad'}</h2>

            {editingPropertyId ? (
              <button type="button" onClick={resetForm} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200">
                Cancelar
              </button>
            ) : null}
          </div>

          <FormInput label="Titulo" value={form.title ?? ''} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <FormTextarea label="Descripcion" value={form.description ?? ''} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />

          <div className="grid grid-cols-2 gap-3">
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">Tipo</span>
              <select
                value={form.type ?? 'APARTMENT'}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              >
                <option value="APARTMENT">Apartamento</option>
                <option value="HOUSE">Casa</option>
                <option value="VILLA">Villa</option>
                <option value="OFFICE">Oficina</option>
                <option value="COMMERCIAL">Comercial</option>
              </select>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">Estado</span>
              <select
                value={form.status ?? 'DRAFT'}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              >
                <option value="DRAFT">Borrador</option>
                <option value="PUBLISHED">Publicado</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Precio" type="number" value={String(form.price ?? 0)} onChange={(value) => setForm((current) => ({ ...current, price: Number(value) }))} />
            <FormInput label="m2" type="number" value={String(form.area ?? 0)} onChange={(value) => setForm((current) => ({ ...current, area: Number(value) }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Habitaciones" type="number" value={String(form.rooms ?? 0)} onChange={(value) => setForm((current) => ({ ...current, rooms: Number(value) }))} />
            <FormInput label="Banos" type="number" value={String(form.bathrooms ?? 0)} onChange={(value) => setForm((current) => ({ ...current, bathrooms: Number(value) }))} />
          </div>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Imagen de portada <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="text"
              value={form.coverImage ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, coverImage: event.target.value }))}
              placeholder="https://... imagen de portada o miniatura"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              URL panorama 360 <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="text"
              value={form.panoramaUrl ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, panoramaUrl: event.target.value }))}
              placeholder="/demo/panorama-living-room.jpg"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Dirección <span className="font-semibold text-slate-400">(opcional)</span>
            </span>
            <input
              type="text"
              value={form.address ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Calle Mayor 1, Madrid"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Latitud <span className="font-semibold text-slate-400">(opcional)</span>
              </span>
              <input
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value !== '' ? Number(event.target.value) : null }))}
                placeholder="40.4168"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-700">
                Longitud <span className="font-semibold text-slate-400">(opcional)</span>
              </span>
              <input
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value !== '' ? Number(event.target.value) : null }))}
                placeholder="-3.7038"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-slate-700">
              Contraseña del tour <span className="font-semibold text-slate-400">(opcional — deja vacío para acceso libre)</span>
            </span>
            <input
              type="password"
              value={form.password ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Contraseña para proteger el tour"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
            />
          </label>

          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}

          <button disabled={isLoading} type="submit" className="mt-5 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60" style={bgStyle}>
            {isLoading ? 'Guardando...' : editingPropertyId ? 'Guardar cambios' : 'Crear propiedad'}
          </button>
        </form>

        <section className="space-y-4">
          {!isLoading && properties.length === 0 ? (
            <EmptyState
              icon={IcoBuilding}
              title="Crea tu primera propiedad inmersiva"
              body="Empieza a medir visitas, contactos y rendimiento comercial desde un solo lugar."
            />
          ) : null}
          {properties.map((property) => (
            <article key={property.id} className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                      {property.type}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${
                      property.status === 'PUBLISHED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {property.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>

                  <h3 className="text-xl font-black">{property.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{property.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'} - {property.area} m2 - {formatCurrency(property.price)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate(`/property/${property.id}`)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                    Ver
                  </button>

                  <button type="button" onClick={() => handleOpenSpaces(property)} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700 hover:bg-violet-100">
                    Estancias ({property.spaces.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleViewLeads(property.id)}
                    className={`rounded-full px-4 py-2 text-sm font-black ${
                      leadsPropertyId === property.id
                        ? 'bg-cyan-700 text-white'
                        : 'border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                    }`}
                  >
                    Leads ({property.leads})
                  </button>

                  <button type="button" onClick={() => handleEditProperty(property)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleTogglePublish(property)}
                    className={`rounded-full px-4 py-2 text-sm font-black ${
                      property.status === 'PUBLISHED'
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {property.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}
                  </button>

                  <button type="button" onClick={() => void handleDeleteProperty(property.id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100">
                    Eliminar
                  </button>
                </div>
              </div>

              {/* ── Quick action footer ── */}
              <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-3 dark:border-white/5">
                {/* Copy public link */}
                <button
                  type="button"
                  title="Copiar link público"
                  onClick={(e) => { e.stopPropagation(); handleCopyProp(property.id, 'link', `${window.location.origin}/property/${property.id}`); }}
                  className="flex items-center gap-1.5 rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/80"
                >
                  {copiedPropId === property.id && copiedPropType === 'link' ? IcoCheckSm : IcoLink}
                  <span className="hidden text-ip-xs font-medium lg:block">
                    {copiedPropId === property.id && copiedPropType === 'link' ? 'Copiado' : 'Copiar link'}
                  </span>
                </button>
                {/* WhatsApp share */}
                <button
                  type="button"
                  title="Compartir por WhatsApp"
                  onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/?text=${encodeURIComponent(`Te comparto el tour inmersivo de ${property.title}: ${window.location.origin}/property/${property.id}`)}`, '_blank'); }}
                  className="flex items-center gap-1.5 rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/80"
                >
                  {IcoWhatsApp}
                  <span className="hidden text-ip-xs font-medium lg:block">WhatsApp</span>
                </button>
                {/* Copy embed */}
                <button
                  type="button"
                  title="Copiar código embed"
                  onClick={(e) => { e.stopPropagation(); handleCopyProp(property.id, 'embed', `<iframe src="${window.location.origin}/embed/${property.id}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`); }}
                  className="flex items-center gap-1.5 rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/80"
                >
                  {copiedPropId === property.id && copiedPropType === 'embed' ? IcoCheckSm : IcoCode}
                  <span className="hidden text-ip-xs font-medium lg:block">
                    {copiedPropId === property.id && copiedPropType === 'embed' ? 'Copiado' : 'Embed'}
                  </span>
                </button>
                {/* PDF download */}
                <button
                  type="button"
                  title="Descargar PDF"
                  onClick={(e) => { e.stopPropagation(); window.open(`/api/properties/${property.id}/report.pdf`, '_blank'); }}
                  className="flex items-center gap-1.5 rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/80"
                >
                  {IcoFilePdf}
                  <span className="hidden text-ip-xs font-medium lg:block">PDF</span>
                </button>
                {/* Ver leads */}
                <button
                  type="button"
                  title="Ver leads de esta propiedad"
                  onClick={(e) => { e.stopPropagation(); navigate(`/leads?propertyId=${property.id}`); }}
                  className="flex items-center gap-1.5 rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-white/30 dark:hover:bg-white/5 dark:hover:text-white/80"
                >
                  {IcoUsers}
                  <span className="hidden text-ip-xs font-medium lg:block">Leads</span>
                </button>
              </div>

              {expandedPropertyId === property.id ? (
                <div className="mt-5 rounded-[1.25rem] border border-violet-100 bg-violet-50/60 p-4">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">Gestor de estancias</h4>
                      <p className="text-sm font-semibold text-slate-500">Crear, editar, ocultar o eliminar espacios de esta propiedad.</p>
                    </div>
                    <button type="button" onClick={() => resetSpaceForm(property.id)} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                      Nueva estancia
                    </button>
                  </div>

                  <form onSubmit={(event) => void handleSubmitSpace(event, property.id)} className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 md:grid-cols-[1fr_110px_140px_auto] md:items-end">
                    <FormInput label="Nombre estancia" value={spaceForm.name ?? ''} onChange={(value) => setSpaceForm((current) => ({ ...current, name: value }))} />
                    <FormInput label="Orden" type="number" value={String(spaceForm.order ?? 1)} onChange={(value) => setSpaceForm((current) => ({ ...current, order: Number(value) }))} />

                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-black text-slate-700">Estado</span>
                      <select
                        value={spaceForm.status ?? 'ACTIVE'}
                        onChange={(event) => setSpaceForm((current) => ({ ...current, status: event.target.value as CreateSpacePayload['status'] }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                      >
                        <option value="ACTIVE">Activa</option>
                        <option value="HIDDEN">Oculta</option>
                      </select>
                    </label>

                    <button disabled={isLoading} type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60">
                      {editingSpace?.propertyId === property.id ? 'Guardar estancia' : 'Crear estancia'}
                    </button>
                  </form>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {property.spaces.length === 0 ? (
                      <div className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                        Esta propiedad todavia no tiene estancias.
                      </div>
                    ) : (
                      property.spaces.map((space) => (
                        <div key={space.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="mb-2 flex flex-wrap gap-2">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">Orden {space.order}</span>
                                <span className={space.status === 'HIDDEN' ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700' : 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700'}>
                                  {space.status === 'HIDDEN' ? 'Oculta' : 'Activa'}
                                </span>
                                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                                  {space.assets.length} assets
                                </span>
                              </div>
                              <p className="text-base font-black text-slate-950">{space.name}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => handleOpenAssetForm(property.id, space.id)} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-black text-violet-700 hover:bg-violet-100">
                                Nuevo asset
                              </button>
                              <button type="button" onClick={() => handleEditSpace(property.id, space)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                                Editar
                              </button>
                              <button type="button" onClick={() => void handleToggleSpaceStatus(property.id, space)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                                {space.status === 'HIDDEN' ? 'Activar' : 'Ocultar'}
                              </button>
                              <button type="button" onClick={() => void handleDeleteSpace(property.id, space.id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100">
                                Eliminar
                              </button>
                            </div>
                          </div>

                          {activeAssetFormTarget?.propertyId === property.id && activeAssetFormTarget?.spaceId === space.id ? (
                            <form onSubmit={(event) => void handleSubmitAsset(event, property.id, space.id)} className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 md:grid-cols-2">
                              <div className="md:col-span-2">
                                <p className="text-sm font-black text-slate-950">
                                  {editingAsset?.propertyId === property.id && editingAsset?.spaceId === space.id ? 'Editar asset' : 'Nuevo asset'}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  Conecta una URL real de panorama 360, Gaussian Splat o mesh 3D.
                                </p>
                              </div>

                              <label className="block">
                                <span className="mb-2 block text-sm font-black text-slate-700">Tipo asset</span>
                                <select
                                  value={assetForm.type}
                                  onChange={(event) => handleAssetTypeChange(event.target.value as CreateAssetPayload['type'])}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                >
                                  <option value="panorama_360">Panorama 360</option>
                                  <option value="gaussian_splat">Gaussian Splat</option>
                                  <option value="mesh">Mesh 3D</option>
                                </select>
                              </label>

                              <label className="block">
                                <span className="mb-2 block text-sm font-black text-slate-700">Formato</span>
                                <select
                                  value={assetForm.format}
                                  onChange={(event) => setAssetForm((current) => ({ ...current, format: event.target.value as CreateAssetPayload['format'] }))}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                >
                                  <option value="jpg">JPG</option>
                                  <option value="jpeg">JPEG</option>
                                  <option value="png">PNG</option>
                                  <option value="webp">WEBP</option>
                                  <option value="splat">SPLAT</option>
                                  <option value="ply">PLY</option>
                                  <option value="glb">GLB</option>
                                </select>
                              </label>

                              <div className="md:col-span-2">
                                <span className="mb-2 block text-sm font-black text-slate-700">Subir archivo</span>
                                <label
                                  className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${
                                    isUploadingAsset
                                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                                      : isDragOver
                                        ? 'border-violet-500 bg-violet-100 scale-[1.01]'
                                        : 'border-violet-300 bg-violet-50/50 hover:bg-violet-50'
                                  }`}
                                  onDragOver={(e) => { e.preventDefault(); if (!isUploadingAsset) setIsDragOver(true); }}
                                  onDragEnter={(e) => { e.preventDefault(); if (!isUploadingAsset) setIsDragOver(true); }}
                                  onDragLeave={() => { setIsDragOver(false); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragOver(false);
                                    if (isUploadingAsset) return;
                                    const file = e.dataTransfer.files[0];
                                    if (file) void processAssetFile(file);
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.splat,.ply,.glb"
                                    onChange={(event) => void handleAssetFileUpload(event)}
                                    disabled={isUploadingAsset}
                                    className="sr-only"
                                  />
                                  {isUploadingAsset ? (
                                    <span className="mb-1 h-6 w-6 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                                  ) : null}
                                  <span className="text-sm font-bold text-violet-700">
                                    {isUploadingAsset ? 'Subiendo archivo...' : isDragOver ? 'Suelta el archivo aquí' : 'Haz clic o arrastra un archivo aquí'}
                                  </span>
                                  <span className="mt-1 text-xs font-semibold text-slate-400">
                                    JPG, JPEG, PNG, WEBP, SPLAT, PLY o GLB. Maximo 100 MB.
                                  </span>
                                </label>
                                {selectedAssetFileName ? (
                                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
                                    <span className="text-base leading-none text-emerald-600">✓</span>
                                    <p className="text-xs font-bold text-emerald-700">
                                      Subido: {selectedAssetFileName}
                                    </p>
                                  </div>
                                ) : null}
                              </div>

                              <label className="block md:col-span-2">
                                <span className="mb-2 block text-sm font-black text-slate-700">URL del asset <span className="font-semibold text-slate-400">(o pega una URL directamente)</span></span>
                                <input
                                  type="url"
                                  value={assetForm.url ?? ''}
                                  onChange={(event) => setAssetForm((current) => ({ ...current, url: event.target.value }))}
                                  placeholder="https://..."
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                />
                              </label>

                              <label className="block">
                                <span className="mb-2 block text-sm font-black text-slate-700">Thumbnail opcional</span>
                                <input
                                  type="url"
                                  value={assetForm.thumbnail ?? ''}
                                  onChange={(event) => setAssetForm((current) => ({ ...current, thumbnail: event.target.value }))}
                                  placeholder="https://..."
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                />
                              </label>

                              <label className="block">
                                <span className="mb-2 block text-sm font-black text-slate-700">Peso MB</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={String(assetForm.size ?? 0)}
                                  onChange={(event) => setAssetForm((current) => ({ ...current, size: Number(event.target.value) }))}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                />
                              </label>

                              {/* ── Visual hotspot placement editor (panorama_360 only) ── */}
                              {assetForm.type === 'panorama_360' && assetForm.url.trim() ? (
                                <div
                                  ref={hotspotPreviewRef}
                                  className={`relative md:col-span-2 overflow-hidden rounded-2xl bg-slate-900 select-none ${showHotspotForm ? 'cursor-crosshair' : 'cursor-default'}`}
                                  style={{ aspectRatio: '16/9' }}
                                  onClick={(e) => {
                                    if (!showHotspotForm || draggingHotspotIdx !== null) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                                    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                                    setHotspotDraft((d) => ({ ...d, x, y }));
                                  }}
                                  onPointerMove={(e) => {
                                    if (draggingHotspotIdx === null) return;
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
                                    const y = Math.max(0, Math.min(100, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
                                    if (draggingHotspotIdx === -1) {
                                      setHotspotDraft((d) => ({ ...d, x, y }));
                                    } else {
                                      setAssetForm((curr) => ({
                                        ...curr,
                                        hotspots: (curr.hotspots ?? []).map((h, i) =>
                                          i === draggingHotspotIdx ? { ...h, position: { x, y } } : h
                                        )
                                      }));
                                    }
                                  }}
                                  onPointerUp={() => setDraggingHotspotIdx(null)}
                                  onPointerLeave={() => setDraggingHotspotIdx(null)}
                                >
                                  <img
                                    src={assetForm.url}
                                    alt="Vista previa 360"
                                    className="pointer-events-none h-full w-full object-cover"
                                    draggable={false}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />

                                  {/* Existing hotspot pins */}
                                  {(assetForm.hotspots ?? []).map((hotspot, idx) => (
                                    <div
                                      key={hotspot.id}
                                      className="absolute -translate-x-1/2 -translate-y-1/2 flex touch-none flex-col items-center gap-0.5"
                                      style={{
                                        left: `${hotspot.position.x}%`,
                                        top: `${hotspot.position.y}%`,
                                        zIndex: draggingHotspotIdx === idx ? 20 : 10,
                                        cursor: draggingHotspotIdx === idx ? 'grabbing' : 'grab'
                                      }}
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDraggingHotspotIdx(idx);
                                      }}
                                    >
                                      <div className={`h-5 w-5 rounded-full border-2 border-white shadow-lg ring-1 ring-black/20 ${
                                        hotspot.type === 'navigation' ? 'bg-blue-500' :
                                        hotspot.type === 'cta' ? 'bg-emerald-500' :
                                        hotspot.type === 'measurement' ? 'bg-amber-500' :
                                        'bg-violet-500'
                                      }`} />
                                      <div className="max-w-[96px] truncate rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold leading-tight text-white">
                                        {hotspot.label}
                                      </div>
                                    </div>
                                  ))}

                                  {/* Draft pin — shown while hotspot form is open */}
                                  {showHotspotForm ? (
                                    <div
                                      className="absolute -translate-x-1/2 -translate-y-1/2 flex touch-none flex-col items-center gap-0.5"
                                      style={{
                                        left: `${hotspotDraft.x}%`,
                                        top: `${hotspotDraft.y}%`,
                                        zIndex: 15,
                                        cursor: draggingHotspotIdx === -1 ? 'grabbing' : 'grab'
                                      }}
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDraggingHotspotIdx(-1);
                                      }}
                                    >
                                      <div className="h-5 w-5 animate-pulse rounded-full border-2 border-white bg-violet-400 shadow-lg ring-2 ring-violet-300/50" />
                                      <div className="max-w-[96px] truncate rounded-full bg-violet-700/80 px-2 py-0.5 text-[10px] font-bold leading-tight text-white">
                                        {hotspotDraft.label || 'nuevo'}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Status bar */}
                                  {showHotspotForm ? (
                                    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                                      Haz clic para colocar · Arrastra para mover
                                    </div>
                                  ) : (assetForm.hotspots ?? []).length > 0 ? (
                                    <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                                      {(assetForm.hotspots ?? []).length} hotspot{(assetForm.hotspots ?? []).length !== 1 ? 's' : ''}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="md:col-span-2">
                                <div className="mb-3 flex items-center justify-between">
                                  <p className="text-sm font-black text-slate-950">
                                    Hotspots ({(assetForm.hotspots ?? []).length})
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setShowHotspotForm((v) => !v)}
                                    className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-violet-700"
                                  >
                                    {showHotspotForm ? 'Cancelar' : '+ Añadir hotspot'}
                                  </button>
                                </div>

                                {(assetForm.hotspots ?? []).length > 0 ? (
                                  <div className="mb-3 space-y-2">
                                    {(assetForm.hotspots ?? []).map((hotspot, index) => (
                                      <div key={hotspot.id} className="flex items-center justify-between rounded-xl bg-white px-4 py-2 ring-1 ring-slate-200">
                                        <div className="flex min-w-0 items-center gap-2">
                                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-black ${
                                            hotspot.type === 'cta' ? 'bg-emerald-50 text-emerald-700' :
                                            hotspot.type === 'navigation' ? 'bg-blue-50 text-blue-700' :
                                            hotspot.type === 'measurement' ? 'bg-amber-50 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                          }`}>{hotspot.type}</span>
                                          <span className="truncate text-sm font-bold text-slate-800">{hotspot.label}</span>
                                          {hotspot.type === 'navigation' && hotspot.targetSpaceId ? (
                                            <span className="shrink-0 text-xs text-blue-500">→ {property.spaces.find((s) => s.id === hotspot.targetSpaceId)?.name ?? '?'}</span>
                                          ) : null}
                                          <span className="shrink-0 text-xs text-slate-400">({hotspot.position.x},{hotspot.position.y})</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveHotspot(index)}
                                          className="ml-2 shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-100"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {showHotspotForm ? (
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                      <label className="col-span-2 block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Etiqueta</span>
                                        <input
                                          type="text"
                                          value={hotspotDraft.label}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, label: e.target.value }))}
                                          placeholder="Ej: Salón principal"
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Tipo</span>
                                        <select
                                          value={hotspotDraft.type}
                                          onChange={(e) => {
                                            const newType = e.target.value as Hotspot['type'];
                                            setHotspotDraft((d) => ({
                                              ...d,
                                              type: newType,
                                              // clear targetSpaceId when leaving navigation type
                                              targetSpaceId: newType === 'navigation' ? d.targetSpaceId : ''
                                            }));
                                          }}
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        >
                                          <option value="info">Info</option>
                                          <option value="cta">CTA</option>
                                          <option value="navigation">Navegación</option>
                                          <option value="measurement">Medición</option>
                                        </select>
                                      </label>

                                      {hotspotDraft.type === 'navigation' ? (
                                        <label className="col-span-2 block">
                                          <span className="mb-1 block text-xs font-black text-slate-700">Conectar con estancia</span>
                                          <select
                                            value={hotspotDraft.targetSpaceId}
                                            onChange={(e) => {
                                              const targetId = e.target.value;
                                              const targetName = property.spaces.find((s) => s.id === targetId)?.name ?? '';
                                              setHotspotDraft((d) => ({
                                                ...d,
                                                targetSpaceId: targetId,
                                                // auto-label only if label is empty or a previous auto-suggestion
                                                label: (d.label === '' || d.label.startsWith('Ir a '))
                                                  ? (targetName ? `Ir a ${targetName}` : d.label)
                                                  : d.label
                                              }));
                                            }}
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                          >
                                            <option value="">— Selecciona una estancia —</option>
                                            {property.spaces
                                              .filter((s) => s.id !== space.id)
                                              .sort((a, b) => a.order - b.order)
                                              .map((s) => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                              ))
                                            }
                                          </select>
                                          <p className="mt-1 text-xs text-slate-400">El visitante irá a esta estancia al pulsar el hotspot.</p>
                                        </label>
                                      ) : null}

                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Descripción</span>
                                        <input
                                          type="text"
                                          value={hotspotDraft.body}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, body: e.target.value }))}
                                          placeholder="Texto informativo"
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Métrica</span>
                                        <input
                                          type="text"
                                          value={hotspotDraft.metric}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, metric: e.target.value }))}
                                          placeholder="Ej: 25 m²"
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Posición X (0–100)</span>
                                        <input
                                          type="number"
                                          min="0" max="100"
                                          value={hotspotDraft.x}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, x: Number(e.target.value) }))}
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="mb-1 block text-xs font-black text-slate-700">Posición Y (0–100)</span>
                                        <input
                                          type="number"
                                          min="0" max="100"
                                          value={hotspotDraft.y}
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, y: Number(e.target.value) }))}
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        />
                                      </label>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={handleAddHotspot}
                                      disabled={
                                        !hotspotDraft.label.trim() ||
                                        (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId)
                                      }
                                      className="mt-3 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-50"
                                    >
                                      Añadir hotspot
                                    </button>
                                  </div>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-2 md:col-span-2">
                                <button disabled={isLoading || isUploadingAsset} type="submit" className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60">
                                  {isUploadingAsset
                                    ? 'Subiendo archivo...'
                                    : editingAsset?.propertyId === property.id && editingAsset?.spaceId === space.id
                                      ? 'Guardar asset'
                                      : 'Crear asset'}
                                </button>
                                <button type="button" onClick={closeAssetForm} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                                  Cancelar
                                </button>
                              </div>
                            </form>
                          ) : null}

                          {assetForm.type === 'mesh' &&
                          (assetForm.url ?? '').trim().length > 0 &&
                          !String(assetForm.url ?? '').startsWith('demo://') &&
                          activeAssetFormTarget?.propertyId === property.id &&
                          activeAssetFormTarget?.spaceId === space.id ? (
                            <div className="mt-4">
                              <p className="mb-2 text-sm font-black text-slate-950">
                                Vista previa del objeto 3D
                              </p>
                              <Suspense fallback={
                                <div className="flex min-h-[300px] items-center justify-center rounded-[1.5rem] bg-slate-100">
                                  <p className="text-sm font-bold text-slate-400">Cargando modelo 3D...</p>
                                </div>
                              }>
                                <GlbViewer
                                  src={String(assetForm.url ?? '')}
                                  cameraControls
                                  autoRotate
                                />
                              </Suspense>
                            </div>
                          ) : null}

                          <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-black text-slate-950">Assets de la estancia</p>
                                <p className="text-xs font-semibold text-slate-500">Panorama 360, Gaussian Splat o mesh 3D asociados al espacio.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              {space.assets.length === 0 ? (
                                <div className="rounded-xl bg-white p-3 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                                  Esta estancia no tiene assets.
                                </div>
                              ) : (
                                space.assets.map((asset) => (
                                  <div key={asset.id} className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200 md:flex-row md:items-center md:justify-between">
                                    <div className="flex items-start gap-3">
                                      {asset.thumbnail && !isFallbackAssetId(asset.id) ? (
                                        <img
                                          src={asset.thumbnail}
                                          alt={asset.type}
                                          className="h-14 w-14 flex-shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                                          asset.type === 'gaussian_splat'
                                            ? 'bg-violet-100 text-violet-700'
                                            : asset.type === 'mesh'
                                              ? 'bg-fuchsia-100 text-fuchsia-700'
                                              : 'bg-cyan-100 text-cyan-700'
                                        }`}>
                                          {asset.type === 'gaussian_splat' ? 'SPLAT' : asset.type === 'mesh' ? 'GLB' : '360'}
                                        </div>
                                      )}
                                      <div>
                                        <div className="mb-2 flex flex-wrap gap-2">
                                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{asset.type}</span>
                                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{asset.format}</span>
                                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{asset.size} MB</span>
                                          {isFallbackAssetId(asset.id) ? (
                                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Demo temporal</span>
                                          ) : null}
                                        </div>
                                        <p className="max-w-xl truncate text-sm font-bold text-slate-700">{asset.url || 'Sin URL'}</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <button type="button" onClick={() => handleEditAsset(property.id, space.id, asset)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                                        Editar asset
                                      </button>
                                      <button type="button" onClick={() => void handleDeleteAsset(property.id, space.id, asset.id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100">
                                        Eliminar asset
                                      </button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      ))                    )}
                  </div>
                </div>
              ) : null}

              {leadsPropertyId === property.id ? (
                <div className="mt-5 rounded-[1.25rem] border border-cyan-100 bg-cyan-50/60 p-4">
                  <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-lg font-black text-slate-950">Leads captados</h4>
                      <p className="text-sm font-semibold text-slate-500">Contactos recibidos desde el visor inmersivo.</p>
                    </div>
                    {leads.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleExportLeadsCsv(property.id, property.title)}
                        className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        Exportar CSV
                      </button>
                    ) : null}
                  </div>

                  {leadsLoading ? (
                    <p className="text-sm font-bold text-slate-500">Cargando leads...</p>
                  ) : leadsError ? (
                    <div className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{leadsError}</div>
                  ) : leads.length === 0 ? (
                    <div className="rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                      Esta propiedad aún no tiene leads capturados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Teléfono</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Notas</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Fuente</th>
                            <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, index) => (
                            <tr key={lead.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-4 py-3 font-semibold text-slate-800">{lead.email}</td>
                              <td className="px-4 py-3 text-slate-600">{lead.phone || '—'}</td>
                              <td className="max-w-xs px-4 py-3 text-slate-600">
                                <span className="line-clamp-1">{lead.notes || '—'}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{lead.source}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-500">
                                {new Date(lead.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function FormInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }): JSX.Element {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <input type={type} required value={value} onChange={(event) => onChange(event.target.value)} className="brand-focus w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none" />
    </label>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="brand-focus w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none" />
    </label>
  );
}

function SettingsPage(): JSX.Element {
  const { user, hydrateFromStorage } = useAuthStore();
  const [usage, setUsage] = useState<TenantUsageResponse | null>(null);
  const [storage, setStorage] = useState<StorageUsageResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState(user?.tenant.webhookUrl ?? '');
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.tenant.phone ?? '');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [removeBranding, setRemoveBranding] = useState(user?.tenant.removeBranding ?? false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState(user?.tenant.whatsappNumber ?? '');
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [primaryColorInput, setPrimaryColorInput] = useState(user?.tenant.primaryColor ?? '#7C3AED');
  const [colorSaving, setColorSaving] = useState(false);
  const [logoTextInput, setLogoTextInput] = useState(user?.tenant.logoText ?? '');

  useEffect(() => {
    void loadBillingState();
  }, []);

  async function loadBillingState(): Promise<void> {
    try {
      const [usageResponse, subscriptionResponse, storageResponse] = await Promise.all([
        unwrapApiResponse<TenantUsageResponse>(api.get('/tenants/usage')),
        unwrapApiResponse<SubscriptionResponse>(api.get('/subscriptions/current')),
        unwrapApiResponse<StorageUsageResponse>(api.get('/tenants/storage'))
      ]);
      setUsage(usageResponse);
      setSubscription(subscriptionResponse);
      setStorage(storageResponse);
      hydrateFromStorage();
      setError(null);
    } catch (error) {
      setError(getApiErrorMessage(error));
    }
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setSettingsMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      );
      await unwrapApiResponse(api.put('/tenants/settings', { logoUrl: upload.url }));
      hydrateFromStorage();
      setSettingsMsg('Logo actualizado correctamente.');
      // Reload user from API to reflect change in header
      const settings = await unwrapApiResponse<{ id: string; logoUrl: string }>(api.get('/tenants/settings'));
      const stored = window.localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.tenant.logoUrl = settings.logoUrl;
        window.localStorage.setItem('user', JSON.stringify(parsed));
        hydrateFromStorage();
      }
    } catch {
      setSettingsMsg('Error al subir el logo.');
    } finally {
      setLogoUploading(false);
      event.target.value = '';
    }
  }

  async function handleSaveWebhook(): Promise<void> {
    const url = webhookInput.trim();
    if (url && !url.startsWith('https://')) {
      setSettingsMsg('La URL del webhook debe empezar por https://');
      return;
    }
    setWebhookSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { webhookUrl: url }));
      setSettingsMsg('Webhook guardado correctamente.');
    } catch {
      setSettingsMsg('Error al guardar el webhook.');
    } finally {
      setWebhookSaving(false);
    }
  }

  async function handleSavePhone(): Promise<void> {
    setPhoneSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { phone: phoneInput.trim() }));
      setSettingsMsg('Teléfono guardado correctamente.');
    } catch {
      setSettingsMsg('Error al guardar el teléfono.');
    } finally {
      setPhoneSaving(false);
    }
  }

  async function handleToggleRemoveBranding(value: boolean): Promise<void> {
    setRemoveBranding(value);
    setBrandingSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { removeBranding: value }));
      setSettingsMsg(value ? 'Marca "Powered by" eliminada del tour.' : 'Marca "Powered by" activada en el tour.');
    } catch {
      setRemoveBranding(!value);
      setSettingsMsg('Error al guardar la configuración.');
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleSaveWhatsapp(): Promise<void> {
    setWhatsappSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { whatsappNumber: whatsappInput.trim() }));
      setSettingsMsg('Número de WhatsApp guardado correctamente.');
    } catch {
      setSettingsMsg('Error al guardar el número de WhatsApp.');
    } finally {
      setWhatsappSaving(false);
    }
  }

  function patchStoredUser(patch: Record<string, unknown>): void {
    const stored = window.localStorage.getItem('user');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      Object.assign(parsed.tenant, patch);
      window.localStorage.setItem('user', JSON.stringify(parsed));
      hydrateFromStorage();
    } catch { /* ignore */ }
  }

  async function handleSaveColor(): Promise<void> {
    if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColorInput)) {
      setSettingsMsg('Color inválido. Usa formato #RRGGBB (ej. #7C3AED).');
      return;
    }
    setColorSaving(true);
    setSettingsMsg(null);
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { primaryColor: primaryColorInput }));
      patchStoredUser({ primaryColor: primaryColorInput });
      setSettingsMsg('Color de marca guardado.');
    } catch {
      setSettingsMsg('Error al guardar el color.');
    } finally {
      setColorSaving(false);
    }
  }

  async function handleSaveLogoText(): Promise<void> {
    const val = logoTextInput.trim().slice(0, 3).toUpperCase();
    if (!val) {
      setSettingsMsg('Las iniciales no pueden estar vacías.');
      return;
    }
    try {
      await unwrapApiResponse(api.put('/tenants/settings', { logoText: val }));
      patchStoredUser({ logoText: val });
      setLogoTextInput(val);
      setSettingsMsg('Iniciales del logo guardadas.');
    } catch {
      setSettingsMsg('Error al guardar las iniciales.');
    }
  }

  async function openPortal(): Promise<void> {
    setPortalLoading(true);
    setError(null);

    try {
      const response = await unwrapApiResponse<{ url: string }>(api.post('/subscriptions/portal'));
      window.location.href = response.url;
    } catch (error) {
      setError(getApiErrorMessage(error));
      setPortalLoading(false);
    }
  }

  const currentPlan = subscription?.plan ?? user?.tenant.plan ?? 'STARTER';
  const { bgStyle, colorStyle } = useBrand();

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>Planes y facturación · Immersphere Pro</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Billing</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Planes y límites</h1>
          <p className="mt-3 text-slate-500">Plan actual: <strong>{currentPlan}</strong>. Propiedades usadas: {usage?.propertiesUsed ?? 0}.</p>
        </div>
        <button
          type="button"
          disabled={portalLoading}
          onClick={openPortal}
          className="rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60"
          style={bgStyle}
        >
          {portalLoading ? 'Abriendo portal...' : 'Gestionar facturación'}
        </button>
      </div>

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      {settingsMsg ? <div className="mt-4 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-700">{settingsMsg}</div> : null}

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Logo de la agencia</p>
        <div className="mt-4 flex items-center gap-5">
          {user?.tenant.logoUrl ? (
            <img src={user.tenant.logoUrl} alt="Logo" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white" style={bgStyle}>
              {logoTextInput.trim().slice(0,3).toUpperCase() || user?.tenant.logoText || '✦'}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <label className={`flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 ${logoUploading ? 'cursor-not-allowed opacity-50' : ''}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { void handleLogoUpload(e); }} disabled={logoUploading} className="sr-only" />
              {logoUploading ? 'Subiendo...' : '↑ Subir imagen'}
            </label>
            <p className="mt-1.5 text-xs text-slate-400">PNG, JPG, WEBP o SVG · 400×400 px recomendado.</p>
            {!user?.tenant.logoUrl ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={logoTextInput}
                  onChange={(e) => setLogoTextInput(e.target.value.slice(0, 3))}
                  maxLength={3}
                  placeholder="IP"
                  className="w-16 rounded-xl border border-slate-200 px-2 py-1.5 text-center text-sm font-black uppercase tracking-widest outline-none focus:border-violet-400"
                />
                <button
                  type="button"
                  onClick={() => { void handleSaveLogoText(); }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 transition hover:border-violet-400 hover:text-violet-700"
                >
                  Guardar iniciales
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Color de marca ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Color de marca</p>
        <p className="mt-1 text-sm text-slate-500">Se aplica a botones, hotspots y CTAs del visor público.</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex items-center">
            <input
              type="color"
              value={primaryColorInput}
              onChange={(e) => setPrimaryColorInput(e.target.value)}
              className="h-11 w-11 cursor-pointer rounded-xl border border-slate-200 p-1 outline-none"
              title="Seleccionar color"
            />
          </div>
          <input
            type="text"
            value={primaryColorInput}
            onChange={(e) => {
              const v = e.target.value;
              setPrimaryColorInput(v);
            }}
            onBlur={(e) => {
              if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                setPrimaryColorInput(user?.tenant.primaryColor ?? '#7C3AED');
              }
            }}
            placeholder="#7C3AED"
            maxLength={7}
            className="w-28 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm font-black uppercase tracking-widest outline-none focus:border-violet-400"
          />
          <button
            type="button"
            disabled={colorSaving}
            onClick={() => { void handleSaveColor(); }}
            className="rounded-2xl px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: primaryColorInput }}
          >
            {colorSaving ? 'Guardando...' : 'Guardar color'}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['#7C3AED', '#2563EB', '#059669', '#DC2626', '#D97706', '#0F172A', '#DB2777', '#0891B2'].map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setPrimaryColorInput(c)}
              className="h-8 w-8 rounded-full border-2 transition hover:scale-110"
              style={{ backgroundColor: c, borderColor: primaryColorInput === c ? '#0f172a' : 'transparent' }}
            />
          ))}
        </div>
      </div>

      {/* ── Preview live ────────────────────────────────────────────── */}
      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Preview de marca</p>
        <p className="mt-1 text-sm text-slate-500">Vista previa en tiempo real de cómo verán tu marca los visitantes.</p>
        <div className="mt-4 overflow-hidden rounded-2xl bg-slate-950 text-white">
          {/* mini viewer header */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            {user?.tenant.logoUrl ? (
              <img src={user.tenant.logoUrl} alt="Logo" className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                style={{ backgroundColor: primaryColorInput }}
              >
                {logoTextInput.trim().slice(0, 3).toUpperCase() || user?.tenant.logoText || 'IP'}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight">{user?.tenant.name || 'Tu Agencia'}</p>
              <p className="text-xs font-semibold leading-tight" style={{ color: primaryColorInput }}>
                Visor inmersivo
              </p>
            </div>
          </div>
          {/* mini property preview */}
          <div className="px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">Propiedad ejemplo</p>
            <p className="mt-1.5 text-lg font-black leading-tight">Apartamento en el centro</p>
            <p className="mt-1 text-sm text-white/50">Tour virtual inmersivo · 4 estancias</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full px-5 py-2 text-xs font-black text-white"
                style={{ backgroundColor: primaryColorInput }}
              >
                Contactar agente
              </button>
              <button
                type="button"
                className="rounded-full bg-white/10 px-5 py-2 text-xs font-black text-white/70"
              >
                ▶ Tour guiado
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Webhook de leads</p>
        <p className="mt-1 text-sm text-slate-500">Cada nuevo lead enviará un POST JSON a esta URL. Debe ser <code className="rounded bg-slate-100 px-1 text-xs">https://</code>.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="url"
            value={webhookInput}
            onChange={(e) => setWebhookInput(e.target.value)}
            placeholder="https://tu-crm.com/webhook/leads"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={webhookSaving}
            onClick={() => { void handleSaveWebhook(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {webhookSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Teléfono de contacto</p>
        <p className="mt-1 text-sm text-slate-500">Número que se mostrará en el chatbot del visor para que los visitantes puedan llamar directamente.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="tel"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="+34 600 000 000"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={phoneSaving}
            onClick={() => { void handleSavePhone(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {phoneSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Eliminar marca "Powered by"</p>
            <p className="mt-1 text-sm text-slate-500">Cuando está activo, elimina la marca "Immersphere Pro" del visor público, del título de la página y del tour ZIP. El tour aparece completamente bajo tu marca.</p>
          </div>
          <button
            type="button"
            disabled={brandingSaving}
            onClick={() => { void handleToggleRemoveBranding(!removeBranding); }}
            className={`relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${removeBranding ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${removeBranding ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">WhatsApp de contacto</p>
        <p className="mt-1 text-sm text-slate-500">Número con prefijo internacional (ej. <code className="rounded bg-slate-100 px-1 text-xs">+34612345678</code>). Aparecerá como botón de WhatsApp en la ficha de propiedad.</p>
        <div className="mt-4 flex gap-3">
          <input
            type="tel"
            value={whatsappInput}
            onChange={(e) => setWhatsappInput(e.target.value)}
            placeholder="+34612345678"
            className="brand-focus flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none"
          />
          <button
            type="button"
            disabled={whatsappSaving}
            onClick={() => { void handleSaveWhatsapp(); }}
            className="rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
            style={bgStyle}
          >
            {whatsappSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {storage ? (
        <div className="mt-6 rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Almacenamiento</p>
              <p className="mt-2 text-2xl font-black text-slate-950">
                {storage.isUnlimited
                  ? 'Ilimitado'
                  : `${storage.usedMb} MB / ${storage.limitMb} MB`}
              </p>
              {!storage.isUnlimited && storage.remainingMb !== null ? (
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {storage.remainingMb} MB disponibles
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              {storage.isUnlimited ? (
                <span className="rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-700">
                  Enterprise — sin limite
                </span>
              ) : (
                <span className={`rounded-full px-4 py-2 text-xs font-black ${
                  storage.percentageUsed >= 90
                    ? 'bg-red-100 text-red-700'
                    : storage.percentageUsed >= 70
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {storage.percentageUsed}% usado
                </span>
              )}
            </div>
          </div>
          {!storage.isUnlimited && storage.limitMb !== null ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  storage.percentageUsed >= 90
                    ? 'bg-red-500'
                    : storage.percentageUsed >= 70
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${storage.percentageUsed}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PlanCard
          plan="STARTER"
          title="Starter"
          price="0 €/mes"
          description="Para validar el flujo con pocas propiedades y visor básico."
          currentPlan={currentPlan}
          onPlanChanged={loadBillingState}
          features={['10 propiedades', 'Visor 360° básico', 'Sin white label completo']}
        />
        <PlanCard
          plan="PROFESSIONAL"
          title="Professional"
          price="49 €/mes"
          description="Para inmobiliarias y estudios que necesitan analítica y marca propia."
          currentPlan={currentPlan}
          onPlanChanged={loadBillingState}
          features={['50 propiedades', 'Hotspots avanzados', 'Analytics', 'White label parcial']}
        />
        <PlanCard
          plan="ENTERPRISE"
          title="Enterprise"
          price="199 €/mes"
          description="Para promotoras, museos, mobiliario y experiencias volumétricas."
          currentPlan={currentPlan}
          onPlanChanged={loadBillingState}
          features={['Propiedades ilimitadas', 'Gaussian Splats', 'API', 'Soporte prioritario']}
        />
      </div>
    </main>
  );
}

function BillingSuccessPage(): JSX.Element {
  const { bgStyle } = useBrand();
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="text-5xl font-black">Suscripción actualizada</h1>
      <p className="mt-4 text-slate-500">Stripe ha procesado el checkout. El webhook actualizará tu plan en el backend.</p>
      <Link to="/settings" className="mt-8 inline-flex rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
        Ver mi plan
      </Link>
    </main>
  );
}

function BillingCancelledPage(): JSX.Element {
  const { bgStyle } = useBrand();
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="text-5xl font-black">Checkout cancelado</h1>
      <p className="mt-4 text-slate-500">No se ha cambiado tu plan.</p>
      <Link to="/settings" className="mt-8 inline-flex rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
        Volver a planes
      </Link>
    </main>
  );
}

function getCompareThumbnail(raw: Record<string, unknown>): string {
  const cover = raw.coverImage as string | undefined;
  if (cover && !cover.startsWith('data:') && !cover.startsWith('demo://')) return cover;
  const spaces = (raw.spaces as Array<{ assets: Array<{ thumbnail?: string; url?: string }> }> | undefined) ?? [];
  for (const space of spaces) {
    for (const asset of space.assets ?? []) {
      for (const u of [asset.thumbnail, asset.url]) {
        if (u && !u.startsWith('data:') && !u.startsWith('demo://')) return u;
      }
    }
  }
  return '';
}

interface CompareData {
  id: string;
  title: string;
  description: string;
  price: number;
  area: number;
  rooms: number;
  bathrooms: number;
  address: string;
  thumbnailUrl: string;
  isPasswordProtected?: boolean;
  spaces: Space[];
  views?: number;
}

function toCompareData(raw: Record<string, unknown>): CompareData {
  if (raw.isPasswordProtected) {
    return {
      id: String(raw.id ?? ''),
      title: String(raw.title ?? 'Propiedad protegida'),
      description: '',
      price: 0,
      area: 0,
      rooms: 0,
      bathrooms: 0,
      address: '',
      thumbnailUrl: '',
      isPasswordProtected: true,
      spaces: []
    };
  }
  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    description: String(raw.description ?? ''),
    price: Number(raw.price ?? 0),
    area: Number(raw.area ?? 0),
    rooms: Number(raw.rooms ?? 0),
    bathrooms: Number(raw.bathrooms ?? 0),
    address: String(raw.address ?? ''),
    thumbnailUrl: getCompareThumbnail(raw),
    isPasswordProtected: false,
    spaces: (raw.spaces ?? []) as Space[],
    views: raw.views !== undefined ? Number(raw.views) : undefined
  };
}

function CompareColumn({ propertyId }: { propertyId: string }): JSX.Element {
  const navigate = useNavigate();
  const { bgStyle } = useBrand();
  const [data, setData] = useState<CompareData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    api.get(`/properties/${propertyId}`)
      .then((res) => {
        const raw = (res.data as { data: Record<string, unknown> }).data;
        setData(toCompareData(raw));
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function handleUnlock(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setUnlocking(true);
    setPasswordError(null);
    try {
      const res = await api.post(`/properties/${propertyId}/unlock`, { password: passwordInput });
      const raw = (res.data as { data: Record<string, unknown> }).data;
      setData(toCompareData(raw));
    } catch {
      setPasswordError('Contraseña incorrecta.');
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-[1.7rem] bg-slate-100 dark:bg-slate-800" style={{ minHeight: '420px' }} />
    );
  }

  if (fetchError || !data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[1.7rem] bg-slate-100 p-6 text-center dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-400">Propiedad no encontrada.</p>
      </div>
    );
  }

  if (data.isPasswordProtected) {
    return (
      <div className="overflow-hidden rounded-[1.7rem] bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600">
          <span className="text-5xl">🔒</span>
        </div>
        <div className="p-5">
          <h3 className="text-xl font-black dark:text-white">{data.title}</h3>
          <p className="mt-1 text-sm text-slate-500">Protegida con contraseña</p>
          <form onSubmit={(e) => void handleUnlock(e)} className="mt-4 flex flex-col gap-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Contraseña"
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            {passwordError && <p className="text-xs font-semibold text-red-500">{passwordError}</p>}
            <button
              type="submit"
              disabled={unlocking || !passwordInput}
              className="rounded-2xl px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
              style={bgStyle}
            >
              {unlocking ? 'Verificando…' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const firstPanoramaSpace = data.spaces.find((s) => s.assets.some((a) => a.type === 'panorama_360'));
  const firstPanoramaAsset = firstPanoramaSpace?.assets.find((a) => a.type === 'panorama_360');
  const hasSplat = data.spaces.some((s) => s.assets.some((a) => a.type === 'gaussian_splat'));

  return (
    <div className="flex flex-col overflow-hidden rounded-[1.7rem] bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
        {data.thumbnailUrl ? (
          <img src={data.thumbnailUrl} alt={data.title} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl text-white/30">✦</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h3 className="text-xl font-black leading-tight">{data.title}</h3>
          <p className="mt-0.5 text-sm text-white/75">{data.area} m² · {data.rooms} hab.</p>
        </div>
      </div>

      {/* Ficha */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-xl font-black dark:text-white">{formatCurrency(data.price)}</p>
        {data.description && (
          <p className="line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{data.description}</p>
        )}
        {data.address && (
          <p className="text-xs text-slate-400">📍 {data.address}</p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-700 dark:text-white">{data.bathrooms} baños</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-700 dark:text-white">{data.spaces.length} estancias</span>
          {data.views !== undefined && data.views > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-700 dark:text-white">👁 {data.views}</span>
          )}
        </div>

        {/* Viewer actions */}
        {hasSplat && (
          <button
            type="button"
            onClick={() => navigate(`/property/${propertyId}`)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700"
          >
            Abrir en visor completo →
          </button>
        )}
        {firstPanoramaAsset && !viewerVisible && (
          <button
            type="button"
            onClick={() => setViewerVisible(true)}
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90"
            style={bgStyle}
          >
            ▶ Cargar visor 360°
          </button>
        )}
        {viewerVisible && firstPanoramaAsset && (
          <button
            type="button"
            onClick={() => setViewerVisible(false)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Cerrar visor
          </button>
        )}
      </div>

      {/* Lazy panorama viewer */}
      {viewerVisible && firstPanoramaSpace && firstPanoramaAsset && (
        <ErrorBoundary fallback={<div className="h-[520px] flex items-center justify-center text-slate-400">Error al cargar el visor.</div>}>
          <Suspense fallback={<div className="h-[520px] animate-pulse bg-slate-100 dark:bg-slate-800" />}>
            <div className="border-t border-slate-100 dark:border-slate-700">
              <PanoramaViewer
                propertyId={propertyId}
                spaceId={firstPanoramaSpace.id}
                asset={firstPanoramaAsset}
                onHotspotClick={() => {}}
                onAnalyticsEvent={() => {}}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

function ComparePage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { bgStyle } = useBrand();
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3);

  if (ids.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h1 className="text-4xl font-black dark:text-white">Sin propiedades seleccionadas</h1>
        <p className="mt-4 text-slate-500">Selecciona 2 o 3 propiedades desde la galería para comparar.</p>
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="mt-8 rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90"
          style={bgStyle}
        >
          Ir a la galería
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
        >
          ← Galería
        </button>
        <h1 className="text-3xl font-black dark:text-white">Comparar propiedades</h1>
      </div>
      <div
        className={`grid grid-cols-1 gap-6 ${
          ids.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {ids.map((id) => (
          <CompareColumn key={id} propertyId={id} />
        ))}
      </div>
    </main>
  );
}

function formatCurrency(value: number): string {
  if (!value) return 'Consultar';

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

interface LeadWithProperty {
  id: string;
  propertyId: string;
  propertyTitle: string;
  email: string;
  phone: string;
  notes: string;
  source: string;
  status: string;
  internalNote: string;
  nextActionAt: string | null;
  nextActionText: string;
  createdAt: string;
  updatedAt: string;
}

const LEAD_STATUSES = ['nuevo', 'contactado', 'visita', 'negociando', 'cerrado', 'descartado'] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

const STATUS_META: Record<LeadStatus, { label: string; bg: string; text: string }> = {
  nuevo:       { label: 'Nuevo',       bg: 'bg-slate-100',   text: 'text-slate-600'  },
  contactado:  { label: 'Contactado',  bg: 'bg-blue-50',     text: 'text-blue-700'   },
  visita:      { label: 'Visita',      bg: 'bg-violet-50',   text: 'text-violet-700' },
  negociando:  { label: 'Negociando',  bg: 'bg-amber-50',    text: 'text-amber-700'  },
  cerrado:     { label: 'Cerrado',     bg: 'bg-emerald-50',  text: 'text-emerald-700'},
  descartado:  { label: 'Descartado',  bg: 'bg-red-50',      text: 'text-red-600'    },
};

const DONE_STATUSES = new Set<string>(['cerrado', 'descartado']);

interface LeadDetailPanelProps {
  lead: LeadWithProperty;
  isSaving: boolean;
  saveError: string | null;
  onSave: (patch: Partial<Pick<LeadWithProperty, 'internalNote' | 'nextActionAt' | 'nextActionText'>>) => void;
}

function LeadDetailPanel({ lead, isSaving, saveError, onSave }: LeadDetailPanelProps): JSX.Element {
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

function LeadsPage(): JSX.Element {
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

      {/* ── Header ── */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={{ color: brandColor }}>CRM</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight dark:text-white">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">{metrics.total} en total · {metrics.thisWeek} esta semana</p>
        </div>
        <button
          type="button"
          onClick={() => void handleExportCsv()}
          disabled={exporting || leads.length === 0}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50"
          style={bgStyle}
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
                        <EmptyState
                          icon={IcoInbox}
                          title="Aún no hay interesados"
                          body="Comparte tu tour por WhatsApp, email o redes para empezar a recibir leads."
                        />
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

const MobileViewerPage = lazy(() => import('@/pages/MobileViewerPage'));

function MobileViewerRoutePage(): JSX.Element {
  const { id } = useParams();
  if (!id) return <Navigate to="/gallery" replace />;
  return (
    <ErrorBoundary fallback={<div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white">Error al cargar el visor móvil.</div>}>
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
        <MobileViewerPage />
      </Suspense>
    </ErrorBoundary>
  );
}

function AppRoutes(): JSX.Element {
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/ayuda" element={<HelpPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/property/:id" element={<PropertyRoutePage />} />
        <Route path="/embed/:id" element={<EmbedRoutePage />} />
        <Route path="/agency/:slug" element={<AgencyPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/cancelled" element={<BillingCancelledPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
        <Route path="/leads" element={<ProtectedRoute><LeadsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App(): JSX.Element {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <Routes>
          {/* Mobile viewer: standalone fullscreen, no AppLayout header/footer */}
          <Route path="/property/:id/mobile" element={<MobileViewerRoutePage />} />
          {/* All other routes get AppLayout */}
          <Route path="*" element={<AppRoutes />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  );
}
