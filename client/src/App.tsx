import { useCallback, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Link, Navigate, Route, Routes, useMatch, useLocation } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useLeadsBadge } from '@/hooks/useLeadsBadge';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
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
import PropertiesPage from '@/pages/PropertiesPage';
import PropertyCreateWizardPage from '@/pages/PropertyCreateWizardPage';
import HelpPage from '@/pages/HelpPage';
import PricingPage from '@/pages/PricingPage';
import CaptureJobsPage from '@/pages/CaptureJobsPage';
import CapturePublicPage from '@/pages/CapturePublicPage';

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

// â”€â”€ Mobile bottom navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    /^\/property\/[^/]+(?:\/[^/]+)?$/.test(location.pathname) ||
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
  const IcoCapture = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 7V5a2 2 0 0 1 2-2h2" />
      <path d="M16 3h2a2 2 0 0 1 2 2v2" />
      <path d="M20 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 21H6a2 2 0 0 1-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
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
        <MobileNavItem to="/capture-jobs" label="Capture" icon={IcoCapture} />
        <MobileNavItem to="/leads" label="Leads" icon={IcoUsers} badge={unreadCount} />
        <MobileNavItem to="/ayuda" label="Ayuda" icon={IcoHelp} />
      </div>
    </nav>
  );
}

// â”€â”€ AppLayout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { bgStyle, colorStyle } = useBrand();
  const [dark, toggleDark] = useDarkMode();
  const { unreadCount } = useLeadsBadge(isAuthenticated);
  const location = useLocation();

  const isViewerRoute =
    /^\/property\/[^/]+(?:\/[^/]+)?$/.test(location.pathname) ||
    location.pathname.startsWith('/embed/');

  const showMobileNav = isAuthenticated && !isViewerRoute;

  const logoText = user?.tenant.logoText ?? '✦';
  const logoUrl = user?.tenant.logoUrl ?? '';
  const brandName = user?.tenant.name ?? 'Immersphere';
  const brandSub = isAuthenticated ? (user?.tenant.plan ?? 'STARTER') : 'Pro SaaS';

  return (
    <div className={`min-h-screen bg-[#F8FAFC] text-slate-950 dark:bg-slate-900 dark:text-slate-100${showMobileNav ? ' pb-20 md:pb-0' : ''}`}>
      {!isViewerRoute && <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/90">
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
            {!isAuthenticated ? <BrandNavLink to="/pricing">Precios</BrandNavLink> : null}
            {isAuthenticated ? (
              <>
                <BrandNavLink to="/dashboard">Dashboard</BrandNavLink>
                <BrandNavLink to="/properties">Propiedades</BrandNavLink>
                <BrandNavLink to="/capture-jobs">Capture</BrandNavLink>
                <div className="relative">
                  <BrandNavLink to="/leads">Leads</BrandNavLink>
                  {unreadCount > 0 ? (
                    <span className="pointer-events-none absolute -right-1 -top-0.5 flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black leading-none text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : null}
                </div>
                <BrandNavLink to="/pricing">Precios</BrandNavLink>
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
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
      </header>}
      {children}
      <MobileBottomNav />
      {!isViewerRoute && <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 sm:flex-row">
          {!user?.tenant.removeBranding ? (
            <p className="text-xs font-bold text-slate-400">
              Powered by <span className="font-black text-slate-600 dark:text-slate-300">Immersphere Pro</span>
              <span className="mx-2 text-slate-200 dark:text-slate-700">·</span>
              <Link to="/pricing" className="font-black text-slate-500 hover:underline dark:text-slate-400">Precios</Link>
              <span className="mx-2 text-slate-200 dark:text-slate-700">·</span>
              <Link to="/ayuda" className="font-black text-slate-500 hover:underline dark:text-slate-400">Ayuda</Link>
            </p>
          ) : (
            <p className="text-xs font-bold text-slate-400">
              <Link to="/pricing" className="font-black text-slate-500 hover:underline dark:text-slate-400">Precios</Link>
              <span className="mx-2 text-slate-200 dark:text-slate-700">·</span>
              <Link to="/ayuda" className="font-black text-slate-500 hover:underline dark:text-slate-400">Ayuda</Link>
            </p>
          )}
          <p className="text-xs font-bold text-slate-400">
            Idea by <span className="font-black text-slate-700 dark:text-slate-300">Rubik Sota</span>
            <a href="tel:+34629554870" className="ml-2 font-black text-slate-700 hover:underline dark:text-slate-300">629 554 870</a>
          </p>
        </div>
      </footer>}
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



// ── Scroll to top on route change ────────────────────────────────────────────
function ScrollToTop(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function AppRoutes(): JSX.Element {
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <AppLayout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/ayuda" element={<HelpPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/property/:id" element={<PropertyRoutePage />} />
        <Route path="/property/:id/:slug" element={<PropertyRoutePage />} />
        <Route path="/capture/:id" element={<CapturePublicPage />} />
        <Route path="/embed/:id" element={<EmbedRoutePage />} />
        <Route path="/agency/:slug" element={<AgencyPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/cancelled" element={<BillingCancelledPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />
        <Route path="/properties/new" element={<ProtectedRoute><PropertyCreateWizardPage /></ProtectedRoute>} />
        <Route path="/capture-jobs" element={<ProtectedRoute><CaptureJobsPage /></ProtectedRoute>} />
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
