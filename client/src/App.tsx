import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import PlanCard from '@/components/billing/PlanCard';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, type CreatePropertyPayload, type ImmersiveProperty } from '@/store/propertyStore';
import PropertyDetailPage from '@/pages/PropertyDetailPage';

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

function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">✦</span>
            <span>
              <span className="block text-sm font-black uppercase tracking-[0.24em]">Immersphere</span>
              <span className="block text-xs font-bold uppercase tracking-[0.2em] text-violet-700">Pro SaaS</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-2 lg:flex">
            <NavLink to="/gallery">Galería</NavLink>
            {isAuthenticated ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/properties">Propiedades</NavLink>
                <NavLink to="/settings">Planes</NavLink>
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="hidden rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 md:inline-flex">
                  {user?.tenant.name ?? 'Tenant'} · {user?.tenant.plan ?? 'STARTER'}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100">
                  Entrar
                </Link>
                <Link to="/register" className="rounded-full bg-slate-950 px-5 py-2 text-sm font-black text-white hover:bg-violet-700">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }): JSX.Element {
  return (
    <Link to={to} className="rounded-full px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100 hover:text-slate-950">
      {children}
    </Link>
  );
}

function LandingPage(): JSX.Element {
  return (
    <main className="bg-[#050712] text-white">
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
      <LoginForm />
    </main>
  );
}

function RegisterPage(): JSX.Element {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
      <RegisterForm />
    </main>
  );
}

function DashboardPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const { properties, fetchProperties, isLoading } = usePropertyStore();
  const [usage, setUsage] = useState<TenantUsageResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProperties({ status: 'DRAFT', limit: 100 });
    void loadBillingState();
  }, [fetchProperties]);

  async function loadBillingState(): Promise<void> {
    try {
      const [usageResponse, subscriptionResponse] = await Promise.all([
        unwrapApiResponse<TenantUsageResponse>(api.get('/tenants/usage')),
        unwrapApiResponse<SubscriptionResponse>(api.get('/subscriptions/current'))
      ]);
      setUsage(usageResponse);
      setSubscription(subscriptionResponse);
      setError(null);
    } catch (error) {
      setError(getApiErrorMessage(error));
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="rounded-[2rem] bg-slate-950 p-7 text-white md:p-9">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">Dashboard</p>
        <h1 className="mt-4 text-5xl font-black tracking-tight">{user?.tenant.name ?? 'Immersphere Pro'}</h1>
        <p className="mt-4 text-white/60">{user?.name} · {user?.email}</p>
      </section>

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Plan" value={subscription?.plan ?? user?.tenant.plan ?? 'STARTER'} />
        <Kpi label="Propiedades" value={isLoading ? '...' : properties.length} />
        <Kpi label="Límite" value={usage?.propertyLimit ?? 'Ilimitado'} />
        <Kpi label="Restantes" value={usage?.remaining ?? '∞'} />
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <article className="rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function GalleryPage(): JSX.Element {
  const navigate = useNavigate();
  const { properties, fetchProperties, isLoading, error } = usePropertyStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    void fetchProperties({ status: 'PUBLISHED' });
  }, [fetchProperties]);

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return properties;

    return properties.filter((property) => `${property.title} ${property.description}`.toLowerCase().includes(normalizedQuery));
  }, [properties, query]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-700">Galería pública</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades publicadas</h1>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar propiedad"
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-500 md:w-80"
        />
      </div>

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      {isLoading ? <p className="mt-8 font-bold text-slate-500">Cargando propiedades...</p> : null}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProperties.map((property) => (
          <PropertyCard key={property.id} property={property} onOpen={() => navigate(`/property/${property.id}`)} />
        ))}
      </div>
    </main>
  );
}

function PropertyCard({ property, onOpen }: { property: ImmersiveProperty; onOpen: () => void }): JSX.Element {
  return (
    <article className="overflow-hidden rounded-[1.7rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
          {property.coverImage ? <img src={property.coverImage} alt={property.title} className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="text-2xl font-black leading-tight">{property.title}</h3>
            <p className="mt-1 text-sm font-semibold text-white/75">{property.area} m² · {property.rooms} hab.</p>
          </div>
        </div>
      </button>
      <div className="p-5">
        <p className="text-xl font-black text-slate-950">{formatCurrency(property.price)}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{property.description}</p>
        <button type="button" onClick={onOpen} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-violet-700">
          Abrir ficha inmersiva
        </button>
      </div>
    </article>
  );
}

function PropertyRoutePage(): JSX.Element {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/gallery" replace />;
  }

  return <PropertyDetailPage propertyId={id} />;
}

function PropertiesPage(): JSX.Element {
  const navigate = useNavigate();
  const { properties, fetchProperties, createProperty, deleteProperty, isLoading, error } = usePropertyStore();
  const [form, setForm] = useState<CreatePropertyPayload>({
    title: '',
    description: '',
    type: 'APARTMENT',
    status: 'DRAFT',
    price: 0,
    area: 80,
    rooms: 2,
    bathrooms: 1,
    coverImage: ''
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void fetchProperties({ status: 'DRAFT', limit: 100 });
  }, [fetchProperties]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    try {
      const property = await createProperty(form);
      setMessage('Propiedad creada correctamente.');
      navigate(`/property/${property.id}`);
    } catch {
      // El store ya expone error.
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-700">Property Manager</p>
      <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-[1.8rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-2xl font-black">Nueva propiedad</h2>
          <FormInput label="Título" value={form.title ?? ''} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <FormTextarea label="Descripción" value={form.description ?? ''} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Precio" type="number" value={String(form.price ?? 0)} onChange={(value) => setForm((current) => ({ ...current, price: Number(value) }))} />
            <FormInput label="m²" type="number" value={String(form.area ?? 0)} onChange={(value) => setForm((current) => ({ ...current, area: Number(value) }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Habitaciones" type="number" value={String(form.rooms ?? 0)} onChange={(value) => setForm((current) => ({ ...current, rooms: Number(value) }))} />
            <FormInput label="Baños" type="number" value={String(form.bathrooms ?? 0)} onChange={(value) => setForm((current) => ({ ...current, bathrooms: Number(value) }))} />
          </div>
          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}
          <button disabled={isLoading} type="submit" className="mt-5 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60">
            {isLoading ? 'Guardando...' : 'Crear propiedad'}
          </button>
        </form>

        <section className="space-y-4">
          {properties.map((property) => (
            <article key={property.id} className="rounded-[1.5rem] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-black">{property.title}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{property.status} · {property.area} m² · {formatCurrency(property.price)}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => navigate(`/property/${property.id}`)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                    Ver
                  </button>
                  <button type="button" onClick={() => void deleteProperty(property.id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100">
                    Eliminar
                  </button>
                </div>
              </div>
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
      <input type={type} required value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-violet-500" />
    </label>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  return (
    <label className="mt-4 block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-violet-500" />
    </label>
  );
}

function SettingsPage(): JSX.Element {
  const { user, hydrateFromStorage } = useAuthStore();
  const [usage, setUsage] = useState<TenantUsageResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    void loadBillingState();
  }, []);

  async function loadBillingState(): Promise<void> {
    try {
      const [usageResponse, subscriptionResponse] = await Promise.all([
        unwrapApiResponse<TenantUsageResponse>(api.get('/tenants/usage')),
        unwrapApiResponse<SubscriptionResponse>(api.get('/subscriptions/current'))
      ]);
      setUsage(usageResponse);
      setSubscription(subscriptionResponse);
      hydrateFromStorage();
      setError(null);
    } catch (error) {
      setError(getApiErrorMessage(error));
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

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-700">Billing</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Planes y límites</h1>
          <p className="mt-3 text-slate-500">Plan actual: <strong>{currentPlan}</strong>. Propiedades usadas: {usage?.propertiesUsed ?? 0}.</p>
        </div>
        <button
          type="button"
          disabled={portalLoading}
          onClick={openPortal}
          className="rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {portalLoading ? 'Abriendo portal...' : 'Gestionar facturación'}
        </button>
      </div>

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}

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
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="text-5xl font-black">Suscripción actualizada</h1>
      <p className="mt-4 text-slate-500">Stripe ha procesado el checkout. El webhook actualizará tu plan en el backend.</p>
      <Link to="/settings" className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-violet-700">
        Ver mi plan
      </Link>
    </main>
  );
}

function BillingCancelledPage(): JSX.Element {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="text-5xl font-black">Checkout cancelado</h1>
      <p className="mt-4 text-slate-500">No se ha cambiado tu plan.</p>
      <Link to="/settings" className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-violet-700">
        Volver a planes
      </Link>
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
        <Route path="/property/:id" element={<PropertyRoutePage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/cancelled" element={<BillingCancelledPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
