import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useMatch, useLocation } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useLeadsBadge } from '@/hooks/useLeadsBadge';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore, type CreateAssetPayload, type CreatePropertyPayload, type CreateSpacePayload, type ImmersiveProperty } from '@/store/propertyStore';
import type { Hotspot, Space } from '@/types/viewer';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import BillingSuccessPage from '@/pages/BillingSuccessPage';
import BillingCancelledPage from '@/pages/BillingCancelledPage';
import PropertyRoutePage from '@/pages/PropertyRoutePage';
import EmbedRoutePage from '@/pages/EmbedRoutePage';
import MobileViewerRoutePage from '@/pages/MobileViewerRoutePage';
import GalleryPage from '@/pages/GalleryPage';
import AgencyPage from '@/pages/AgencyPage';
import ComparePage from '@/pages/ComparePage';
import DashboardPage from '@/pages/DashboardPage';
import SettingsPage from '@/pages/SettingsPage';
import LeadsPage from '@/pages/LeadsPage';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormInput, FormTextarea } from '@/components/ui/FormFields';
import { IcoBuilding, IcoLink, IcoWhatsApp, IcoCode, IcoFilePdf, IcoUsers, IcoCheckSm } from '@/components/ui/icons';
import HelpPage from '@/pages/HelpPage';
import { formatCurrency } from '@/utils/format';
import type { LeadRecord, UploadAssetResponse } from '@/types/api';
const TenantAnalyticsDashboard = lazy(() => import('@/pages/TenantAnalyticsDashboard'));
const GlbViewer = lazy(() => import('@/components/viewer/GlbViewer'));


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

// ── Mobile bottom navigation ────────────────────────────────────────────────

function MobileNavItem({
  to,
  label,
  icon,
  badge,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}): JSX.Element {
  const match = useMatch(to);
  const { color } = useBrand();
  const isActive = !!match;
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-slate-400 transition-colors dark:text-slate-500"
      style={isActive ? { color } : undefined}
    >
      {badge && badge > 0 ? (
        <span className="absolute right-[calc(50%-14px)] top-2 flex min-h-[1rem] min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      {icon}
      <span className="w-full truncate text-center text-[10px] font-black uppercase tracking-[0.08em]">{label}</span>
    </Link>
  );
}

function MobileBottomNav(): JSX.Element | null {
  const { isAuthenticated } = useAuthStore();
  const { unreadCount } = useLeadsBadge(isAuthenticated);
  const location = useLocation();

  // Hide on public viewer and embed routes
  const isViewerRoute =
    /^\/property\/[^/]+$/.test(location.pathname) ||
    location.pathname.startsWith('/embed/');

  if (!isAuthenticated || isViewerRoute) return null;

  const IcoDashboard = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
  const IcoHome = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
  const IcoUsers = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
  const IcoHelp = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
  const IcoSettings = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/95 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch">
        <MobileNavItem to="/dashboard" label="Dashboard" icon={IcoDashboard} />
        <MobileNavItem to="/properties" label="Propiedades" icon={IcoHome} />
        <MobileNavItem to="/leads" label="Leads" icon={IcoUsers} badge={unreadCount} />
        <MobileNavItem to="/ayuda" label="Ayuda" icon={IcoHelp} />
        <MobileNavItem to="/settings" label="Ajustes" icon={IcoSettings} />
      </div>
    </nav>
  );
}

// ── AppLayout ────────────────────────────────────────────────────────────────

function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { bgStyle, colorStyle } = useBrand();
  const [dark, toggleDark] = useDarkMode();
  const { unreadCount } = useLeadsBadge(isAuthenticated);
  const location = useLocation();

  const isViewerRoute =
    /^\/property\/[^/]+$/.test(location.pathname) ||
    location.pathname.startsWith('/embed/');

  const showMobileNav = isAuthenticated && !isViewerRoute;

  const logoText = user?.tenant.logoText ?? '✦';
  const logoUrl = user?.tenant.logoUrl ?? '';
  const brandName = user?.tenant.name ?? 'Immersphere';
  const brandSub = isAuthenticated ? (user?.tenant.plan ?? 'STARTER') : 'Pro SaaS';

  return (
    <div className={`min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-slate-900 dark:text-slate-100${showMobileNav ? ' pb-20 md:pb-0' : ''}`}>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={brandName} className="h-10 w-10 shrink-0 rounded-2xl object-cover" />
            ) : (
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white"
                style={bgStyle}
              >
                {logoText}
              </span>
            )}
            <span className="min-w-0 overflow-hidden">
              <span className="block truncate text-sm font-black uppercase tracking-[0.24em]">{brandName}</span>
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
      <MobileBottomNav />
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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null);
  const [assetPreviewType, setAssetPreviewType] = useState<CreateAssetPayload['type'] | null>(null);
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
  // Index of the hotspot being edited (null = adding new); null | number
  const [editingHotspotIndex, setEditingHotspotIndex] = useState<number | null>(null);
  // Used to detect click vs drag on existing pins
  const pinPointerStart = useRef<{ x: number; y: number; idx: number } | null>(null);
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
    setUploadProgress(0);
    setUploadPhase('idle');
    setAssetPreviewUrl(null);
    setAssetPreviewType(null);
    setShowHotspotForm(false);
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
    setEditingHotspotIndex(null);
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
    setUploadProgress(0);
    setUploadPhase('uploading');
    setAssetPreviewUrl(null);
    setAssetPreviewType(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const pct = progressEvent.total
              ? Math.round((progressEvent.loaded / progressEvent.total) * 90)
              : 0;
            setUploadProgress(pct);
            if (pct >= 90) setUploadPhase('processing');
          }
        })
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

      setUploadProgress(100);
      setUploadPhase('done');
      setAssetPreviewUrl(upload.thumbnailUrl || upload.url || null);
      setAssetPreviewType(detectedType);
      setSelectedAssetFileName(upload.originalName || file.name);
      setMessage('Archivo subido correctamente. Revisa y guarda el asset.');
    } catch (error) {
      setUploadPhase('idle');
      setUploadProgress(0);
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
    // If editing this hotspot, cancel edit mode too
    if (editingHotspotIndex === index) {
      setEditingHotspotIndex(null);
      setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
      setShowHotspotForm(false);
    }
  }

  function handleEditHotspot(index: number): void {
    const hotspot = (assetForm.hotspots ?? [])[index];
    if (!hotspot) return;
    setHotspotDraft({
      label: hotspot.label,
      type: hotspot.type,
      x: hotspot.position.x,
      y: hotspot.position.y,
      body: hotspot.body ?? '',
      metric: hotspot.metric ?? '',
      targetSpaceId: hotspot.targetSpaceId ?? ''
    });
    setEditingHotspotIndex(index);
    setShowHotspotForm(true);
  }

  function handleSaveHotspotEdit(): void {
    if (editingHotspotIndex === null) return;
    if (!hotspotDraft.label.trim()) return;
    if (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId) return;
    setAssetForm((current) => ({
      ...current,
      hotspots: (current.hotspots ?? []).map((h, i) =>
        i === editingHotspotIndex
          ? {
              ...h,
              label: hotspotDraft.label.trim(),
              type: hotspotDraft.type,
              position: { x: hotspotDraft.x, y: hotspotDraft.y },
              body: hotspotDraft.body.trim(),
              metric: hotspotDraft.metric.trim(),
              targetSpaceId: hotspotDraft.targetSpaceId || undefined
            }
          : h
      )
    }));
    setEditingHotspotIndex(null);
    setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
    setShowHotspotForm(false);
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
    setAssetPreviewUrl(null);
    setAssetPreviewType(null);
    setUploadPhase('idle');
    setUploadProgress(0);
    setSelectedAssetFileName(null);

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
    // Show existing thumbnail as preview if available
    if (asset.thumbnail) {
      setAssetPreviewUrl(asset.thumbnail);
      setAssetPreviewType(asset.type);
      setUploadPhase('done');
    }
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
                                  {editingAsset?.propertyId === property.id && editingAsset?.spaceId === space.id ? 'Editar asset inmersivo' : 'Añadir asset inmersivo'}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  Sube una imagen 360°, un modelo 3D o un Gaussian Splat para esta estancia
                                </p>
                              </div>

                              {/* Asset type pill selector */}
                              <div className="md:col-span-2">
                                <span className="mb-2 block text-sm font-black text-slate-700">Tipo de asset</span>
                                <div className="flex gap-2">
                                  {([
                                    { value: 'panorama_360', label: '🌐 Panorama 360°', hint: 'JPG / WebP' },
                                    { value: 'gaussian_splat', label: '✨ Gaussian Splat', hint: 'SPZ / SPLAT / PLY' },
                                    { value: 'mesh', label: '📦 Modelo 3D', hint: 'GLB' }
                                  ] as const).map(({ value, label, hint }) => (
                                    <button
                                      key={value}
                                      type="button"
                                      onClick={() => handleAssetTypeChange(value)}
                                      className={`flex flex-1 flex-col items-center rounded-2xl border px-3 py-3 text-center transition ${
                                        assetForm.type === value
                                          ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-400'
                                          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50/40'
                                      }`}
                                    >
                                      <span className="text-sm font-black leading-none">{label}</span>
                                      <span className="mt-1 text-[10px] font-semibold text-slate-400">{hint}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Format selector — compact, inline */}
                              <div className="md:col-span-2">
                                <label className="block">
                                  <span className="mb-2 block text-sm font-black text-slate-700">Formato detectado <span className="font-semibold text-slate-400">(se autodetecta al subir)</span></span>
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
                              </div>

                              <div className="md:col-span-2">
                                <span className="mb-2 block text-sm font-black text-slate-700">Subir archivo</span>

                                {/* Drop zone */}
                                <label
                                  className={`relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition ${
                                    isUploadingAsset
                                      ? 'cursor-not-allowed border-slate-200 bg-slate-50'
                                      : isDragOver
                                        ? 'scale-[1.01] border-violet-500 bg-violet-100'
                                        : uploadPhase === 'done'
                                          ? 'border-emerald-400 bg-emerald-50/60'
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

                                  {/* Icon */}
                                  {uploadPhase === 'done' ? (
                                    <span className="text-2xl leading-none">✅</span>
                                  ) : isUploadingAsset ? (
                                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                                  ) : (
                                    <span className="text-2xl leading-none">{isDragOver ? '📂' : '📁'}</span>
                                  )}

                                  {/* Label */}
                                  <span className={`text-sm font-black ${uploadPhase === 'done' ? 'text-emerald-700' : 'text-violet-700'}`}>
                                    {isUploadingAsset
                                      ? (uploadPhase === 'processing' ? 'Procesando en Cloudinary…' : `Subiendo… ${uploadProgress}%`)
                                      : isDragOver
                                        ? 'Suelta el archivo aquí'
                                        : uploadPhase === 'done'
                                          ? `✓ ${selectedAssetFileName ?? 'Archivo subido'}`
                                          : 'Arrastra tu archivo aquí o haz clic para seleccionar'}
                                  </span>

                                  {/* Hint */}
                                  {!isUploadingAsset && uploadPhase !== 'done' ? (
                                    <span className="text-xs font-semibold text-slate-400">
                                      JPG / WebP para 360° · GLB para modelos 3D · SPZ / SPLAT / PLY para Gaussian Splats · Máx. 100 MB
                                    </span>
                                  ) : null}

                                  {/* Progress bar */}
                                  {isUploadingAsset ? (
                                    <div className="w-full max-w-xs overflow-hidden rounded-full bg-violet-100">
                                      <div
                                        className="h-1.5 rounded-full bg-violet-500 transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                      />
                                    </div>
                                  ) : null}
                                </label>

                                {/* Preview section — shown after upload */}
                                {uploadPhase === 'done' && assetPreviewUrl ? (
                                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {assetPreviewType === 'panorama_360' ? (
                                      <div className="relative aspect-video bg-slate-900">
                                        <img
                                          src={assetPreviewUrl}
                                          alt="Preview"
                                          className="h-full w-full object-cover"
                                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                                          Vista previa · Panorama 360°
                                        </span>
                                      </div>
                                    ) : (
                                      /* GLB / Splat: file card */
                                      <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-2xl leading-none">
                                          {assetPreviewType === 'gaussian_splat' ? '✨' : '📦'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm font-black text-slate-900">{selectedAssetFileName}</p>
                                          <p className="text-xs font-semibold text-slate-400">
                                            {assetPreviewType === 'gaussian_splat' ? 'Gaussian Splat' : 'Modelo 3D · GLB'}
                                            {(assetForm.size ?? 0) > 0 ? ` · ${assetForm.size} MB` : ''}
                                          </p>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
                                          Subido
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>

                              <div className="md:col-span-2">
                                <label className="block">
                                  <span className="mb-2 block text-sm font-black text-slate-700">
                                    URL del asset <span className="font-semibold text-slate-400">(se rellena automáticamente al subir · o pega una URL directamente)</span>
                                  </span>
                                  <input
                                    type="url"
                                    value={assetForm.url ?? ''}
                                    onChange={(event) => setAssetForm((current) => ({ ...current, url: event.target.value }))}
                                    placeholder="https://res.cloudinary.com/…"
                                    className={`w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none transition ${
                                      assetForm.url && !assetForm.url.startsWith('http')
                                        ? 'border-amber-400 bg-amber-50 focus:border-amber-500'
                                        : 'border-slate-200 bg-white focus:border-violet-400'
                                    }`}
                                  />
                                  {assetForm.url && !assetForm.url.startsWith('http') ? (
                                    <p className="mt-1 text-xs font-semibold text-amber-600">La URL debe empezar por https://</p>
                                  ) : null}
                                </label>
                              </div>

                              {/* Thumbnail + Size — secondary, collapsible feel */}
                              <label className="block">
                                <span className="mb-2 block text-sm font-black text-slate-700">Thumbnail <span className="font-semibold text-slate-400">(auto)</span></span>
                                <input
                                  type="url"
                                  value={assetForm.thumbnail ?? ''}
                                  onChange={(event) => setAssetForm((current) => ({ ...current, thumbnail: event.target.value }))}
                                  placeholder="https://…"
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-violet-400"
                                />
                              </label>

                              <label className="block">
                                <span className="mb-2 block text-sm font-black text-slate-700">Tamaño <span className="font-semibold text-slate-400">(MB · auto)</span></span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
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
                                    } else if (editingHotspotIndex === draggingHotspotIdx) {
                                      // Dragging an editing pin → update draft position
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
                                  onPointerUp={() => {
                                    // Detect click (< 5px movement) on an existing pin → open edit form
                                    if (pinPointerStart.current !== null && draggingHotspotIdx !== null && draggingHotspotIdx >= 0) {
                                      const dx = pinPointerStart.current.x;
                                      const dy = pinPointerStart.current.y;
                                      // dx/dy were stored as clientX/Y at start; compare via ref
                                      void dx; void dy; // already consumed via pinPointerStart
                                    }
                                    pinPointerStart.current = null;
                                    setDraggingHotspotIdx(null);
                                  }}
                                  onPointerLeave={() => {
                                    pinPointerStart.current = null;
                                    setDraggingHotspotIdx(null);
                                  }}
                                >
                                  <img
                                    src={assetForm.url}
                                    alt="Vista previa 360"
                                    className="pointer-events-none h-full w-full object-cover"
                                    draggable={false}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />

                                  {/* Existing hotspot pins — skip the one currently being edited (shown by draft pin) */}
                                  {(assetForm.hotspots ?? []).map((hotspot, idx) => {
                                    if (editingHotspotIndex === idx) return null;
                                    return (
                                      <div
                                        key={hotspot.id}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 flex touch-none flex-col items-center gap-0.5"
                                        style={{
                                          left: `${hotspot.position.x}%`,
                                          top: `${hotspot.position.y}%`,
                                          zIndex: draggingHotspotIdx === idx ? 20 : 10,
                                          cursor: draggingHotspotIdx === idx ? 'grabbing' : (showHotspotForm ? 'grab' : 'pointer')
                                        }}
                                        onPointerDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          pinPointerStart.current = { x: e.clientX, y: e.clientY, idx };
                                          setDraggingHotspotIdx(idx);
                                        }}
                                        onPointerUp={(e) => {
                                          e.stopPropagation();
                                          if (pinPointerStart.current !== null) {
                                            const moved = Math.abs(e.clientX - pinPointerStart.current.x) + Math.abs(e.clientY - pinPointerStart.current.y);
                                            if (moved < 5 && !showHotspotForm) {
                                              // Click: open edit form for this pin
                                              handleEditHotspot(idx);
                                            }
                                          }
                                          pinPointerStart.current = null;
                                          setDraggingHotspotIdx(null);
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
                                    );
                                  })}

                                  {/* Draft pin — shown while hotspot form is open (adding new OR editing existing) */}
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
                                        setDraggingHotspotIdx(editingHotspotIndex !== null ? editingHotspotIndex : -1);
                                      }}
                                    >
                                      <div className={`h-5 w-5 rounded-full border-2 border-white shadow-lg ${
                                        editingHotspotIndex !== null
                                          ? 'bg-orange-400 ring-2 ring-orange-300/60'
                                          : 'animate-pulse bg-violet-400 ring-2 ring-violet-300/50'
                                      }`} />
                                      <div className={`max-w-[96px] truncate rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight text-white ${
                                        editingHotspotIndex !== null ? 'bg-orange-700/80' : 'bg-violet-700/80'
                                      }`}>
                                        {hotspotDraft.label || (editingHotspotIndex !== null ? 'editando' : 'nuevo')}
                                      </div>
                                    </div>
                                  ) : null}

                                  {/* Status bar */}
                                  {showHotspotForm ? (
                                    <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                                      {editingHotspotIndex !== null
                                        ? 'Editando hotspot · Arrastra para mover'
                                        : 'Haz clic para colocar · Arrastra para mover'}
                                    </div>
                                  ) : (assetForm.hotspots ?? []).length > 0 ? (
                                    <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
                                      {(assetForm.hotspots ?? []).length} hotspot{(assetForm.hotspots ?? []).length !== 1 ? 's' : ''} · Pulsa un pin para editar
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
                                    onClick={() => {
                                      if (showHotspotForm) {
                                        setShowHotspotForm(false);
                                        setEditingHotspotIndex(null);
                                        setHotspotDraft({ label: '', type: 'info', x: 50, y: 50, body: '', metric: '', targetSpaceId: '' });
                                      } else {
                                        setShowHotspotForm(true);
                                      }
                                    }}
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
                                        <div className="ml-2 flex shrink-0 gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleEditHotspot(index)}
                                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 hover:bg-violet-100 hover:text-violet-700"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveHotspot(index)}
                                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 hover:bg-red-100"
                                          >
                                            Eliminar
                                          </button>
                                        </div>
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
                                      onClick={editingHotspotIndex !== null ? handleSaveHotspotEdit : handleAddHotspot}
                                      disabled={
                                        !hotspotDraft.label.trim() ||
                                        (hotspotDraft.type === 'navigation' && !hotspotDraft.targetSpaceId)
                                      }
                                      className={`mt-3 rounded-xl px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${
                                        editingHotspotIndex !== null
                                          ? 'bg-orange-500 hover:bg-orange-600'
                                          : 'bg-slate-950 hover:bg-violet-700'
                                      }`}
                                    >
                                      {editingHotspotIndex !== null ? 'Guardar cambios' : 'Añadir hotspot'}
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
