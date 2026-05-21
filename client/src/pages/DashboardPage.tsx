import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';
import { useBrand } from '@/hooks/useBrand';
import { api, unwrapApiResponse, getApiErrorMessage } from '@/services/api';
import type { SubscriptionResponse, DashLead } from '@/types/api';
import { DONE_STATUSES } from '@/constants/leads';
import { CommercialCard } from '@/components/ui/CommercialCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { IcoInbox } from '@/components/ui/icons';
import AvatarWidget from '@/components/AvatarWidget';

const HELP_BANNER_KEY = 'immersphere_help_banner_dismissed';

export default function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { color } = useBrand();
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AvatarWidget size={52} showLabel primaryColor={color} />
          <div>
            <p className="text-ip-xs font-semibold uppercase tracking-[0.22em] text-ip-accent">
              {user?.tenant.name ?? 'Immersphere Pro'}
            </p>
            <h1 className="mt-0.5 text-ip-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {user?.name ? `Hola, ${user.name.split(' ')[0]}` : 'Dashboard'}
            </h1>
          </div>
        </div>
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
