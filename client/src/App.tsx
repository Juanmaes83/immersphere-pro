import { useEffect, useMemo, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useMatch } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import PlanCard from '@/components/billing/PlanCard';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, type CreateAssetPayload, type CreatePropertyPayload, type CreateSpacePayload, type ImmersiveProperty } from '@/store/propertyStore';
import type { Hotspot } from '@/types/viewer';
import PropertyDetailPage from '@/pages/PropertyDetailPage';
import TenantAnalyticsDashboard from '@/pages/TenantAnalyticsDashboard';

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

function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { bgStyle, colorStyle } = useBrand();

  const logoText = user?.tenant.logoText ?? '✦';
  const logoUrl = user?.tenant.logoUrl ?? '';
  const brandName = user?.tenant.name ?? 'Immersphere';
  const brandSub = isAuthenticated ? (user?.tenant.plan ?? 'STARTER') : 'Pro SaaS';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
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
                <BrandNavLink to="/settings">Planes</BrandNavLink>
              </>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
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
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 sm:flex-row">
          <p className="text-xs font-bold text-slate-400">
            Powered by <span className="font-black text-slate-600">Immersphere Pro</span>
          </p>
          <p className="text-xs font-bold text-slate-400">
            Idea by <span className="font-black text-slate-700">Rubik Sota</span>
            <a href="tel:+34629554870" className="ml-2 font-black text-slate-700 hover:underline">629 554 870</a>
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

function DashboardPage(): JSX.Element {
  const user = useAuthStore((state) => state.user);
  const { properties, fetchProperties, isLoading } = usePropertyStore();
  const { colorStyle } = useBrand();
  const [usage, setUsage] = useState<TenantUsageResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchProperties({ limit: 100 });
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
      <Helmet>
        <title>Dashboard · {user?.tenant.name ?? 'Immersphere Pro'}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <section className="rounded-[2rem] bg-slate-950 p-7 text-white md:p-9">
        <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Dashboard</p>
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

      <TenantAnalyticsDashboard />
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

  const { colorStyle } = useBrand();

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <Helmet>
        <title>Galería de propiedades · Immersphere Pro</title>
        <meta name="description" content="Explora propiedades con tours virtuales inmersivos en 360° y Gaussian Splats. Visita los espacios como si estuvieras allí." />
      </Helmet>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Galería pública</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades publicadas</h1>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar propiedad"
          className="brand-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none md:w-80"
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
  const { bgStyle } = useBrand();
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
        <button type="button" onClick={onOpen} className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
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

function EmbedRoutePage(): JSX.Element {
  const { id } = useParams();

  if (!id) {
    return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Tour no encontrado.</div>;
  }

  return (
    <div className="bg-[#F8FAFC] text-slate-950">
      <PropertyDetailPage propertyId={id} embed />
    </div>
  );
}

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
    longitude: null
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
  const [message, setMessage] = useState<string | null>(null);
  const [leadsPropertyId, setLeadsPropertyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [showHotspotForm, setShowHotspotForm] = useState(false);
  const [hotspotDraft, setHotspotDraft] = useState<{ label: string; type: Hotspot['type']; x: number; y: number; body: string; metric: string }>({
    label: '', type: 'info', x: 50, y: 50, body: '', metric: ''
  });
  const { bgStyle, colorStyle } = useBrand();

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
      longitude: null
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
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '' });
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

  async function handleAssetFileUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'splat', 'ply', 'glb'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!allowedExtensions.includes(ext)) {
      setMessage('Formato no permitido. Usa JPG, JPEG, PNG, WEBP, SPLAT, PLY o GLB.');
      event.target.value = '';
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setMessage('El archivo supera el limite de 100 MB.');
      event.target.value = '';
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
      event.target.value = '';
    }
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
    const newHotspot: Hotspot = {
      id: `draft-${Date.now()}`,
      label: hotspotDraft.label.trim(),
      type: hotspotDraft.type,
      position: { x: hotspotDraft.x, y: hotspotDraft.y },
      body: hotspotDraft.body.trim(),
      metric: hotspotDraft.metric.trim()
    };
    setAssetForm((current) => ({ ...current, hotspots: [...(current.hotspots ?? []), newHotspot] }));
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '' });
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
      longitude: form.longitude ?? null
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
        panoramaUrl: property.panoramaUrl
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
      size: Math.max(0, Number(assetForm.size ?? 0)),
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
        <form onSubmit={handleSubmit} className="rounded-[1.8rem] bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
              placeholder="http://localhost:5173/demo/panorama-living-room.jpg"
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

          {error ? <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          {message ? <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</div> : null}

          <button disabled={isLoading} type="submit" className="mt-5 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-60" style={bgStyle}>
            {isLoading ? 'Guardando...' : editingPropertyId ? 'Guardar cambios' : 'Crear propiedad'}
          </button>
        </form>

        <section className="space-y-4">
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
                                <label className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${isUploadingAsset ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60' : 'border-violet-300 bg-violet-50/50 hover:bg-violet-50'}`}>
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.splat,.ply,.glb"
                                    onChange={(event) => void handleAssetFileUpload(event)}
                                    disabled={isUploadingAsset}
                                    className="sr-only"
                                  />
                                  <span className="text-sm font-bold text-violet-700">
                                    {isUploadingAsset ? 'Subiendo...' : 'Haz clic para seleccionar archivo'}
                                  </span>
                                  <span className="mt-1 text-xs font-semibold text-slate-400">
                                    JPG, JPEG, PNG, WEBP, SPLAT, PLY o GLB. Maximo 100 MB.
                                  </span>
                                </label>
                                {selectedAssetFileName ? (
                                  <p className="mt-2 text-xs font-bold text-emerald-700">
                                    Archivo seleccionado: {selectedAssetFileName}
                                  </p>
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
                                        <div className="flex items-center gap-3">
                                          <span className={`rounded-full px-2 py-0.5 text-xs font-black ${
                                            hotspot.type === 'cta' ? 'bg-emerald-50 text-emerald-700' :
                                            hotspot.type === 'navigation' ? 'bg-blue-50 text-blue-700' :
                                            hotspot.type === 'measurement' ? 'bg-amber-50 text-amber-700' :
                                            'bg-slate-100 text-slate-700'
                                          }`}>{hotspot.type}</span>
                                          <span className="text-sm font-bold text-slate-800">{hotspot.label}</span>
                                          <span className="text-xs text-slate-400">({hotspot.position.x},{hotspot.position.y})</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveHotspot(index)}
                                          className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-100"
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
                                          onChange={(e) => setHotspotDraft((d) => ({ ...d, type: e.target.value as Hotspot['type'] }))}
                                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                                        >
                                          <option value="info">Info</option>
                                          <option value="cta">CTA</option>
                                          <option value="navigation">Navegación</option>
                                          <option value="measurement">Medición</option>
                                        </select>
                                      </label>
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
                                      disabled={!hotspotDraft.label.trim()}
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
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white" style={bgStyle}>
              {user?.tenant.logoText ?? '✦'}
            </span>
          )}
          <div>
            <label className={`flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 ${logoUploading ? 'cursor-not-allowed opacity-50' : ''}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => { void handleLogoUpload(e); }} disabled={logoUploading} className="sr-only" />
              {logoUploading ? 'Subiendo...' : '↑ Subir logo'}
            </label>
            <p className="mt-1.5 text-xs text-slate-400">PNG, JPG, WEBP o SVG. Recomendado 400×400 px.</p>
          </div>
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
        <Route path="/embed/:id" element={<EmbedRoutePage />} />
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
    <HelmetProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </HelmetProvider>
  );
}
