import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, CheckCircle2, Copy, ExternalLink, Printer, Share2, ShieldCheck } from 'lucide-react';
import CaptureViewerShell from '@/components/capture/CaptureViewerShell';
import NativeGaussianSplatViewer from '@/components/capture/NativeGaussianSplatViewer';
import NativePointCloudViewer from '@/components/capture/NativePointCloudViewer';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { PublicCaptureJob, PublicCaptureLeadInput, PublicCaptureLeadResponse } from '@/types/api';

const NATIVE_SPLAT_TYPES = ['native_splat', 'gaussian_splat_native', 'spark_splat_viewer', 'splat_native'];
const SELF_HOSTED_SPLAT_TYPES = ['supersplat_self_hosted'];
const PREMIUM_3D_PRIORITY = [
  'native_point_cloud', 'ply_viewer',
  ...NATIVE_SPLAT_TYPES,
  // 25D.1: supersplat_self_hosted sits after experimental native viewers
  // and before legacy external-iframe types
  'supersplat_self_hosted',
  'gaussian_splat', 'splat_viewer', 'supersplat',
  'spark_viewer', 'external_3d_viewer'
];
const NATIVE_POINT_CLOUD_TYPES = ['native_point_cloud', 'ply_viewer'];
const ENABLE_NATIVE_3D_VIEWER = import.meta.env.VITE_ENABLE_NATIVE_3D_VIEWER === 'true';
const ENABLE_NATIVE_SPLAT_VIEWER = import.meta.env.VITE_ENABLE_NATIVE_SPLAT_VIEWER === 'true';

/**
 * 25D.1 — SuperSplat Viewer self-hosted
 * Base URL of the deployed supersplat-viewer static app.
 * Example: https://viewer-immersphere.vercel.app
 * Leave empty to disable self-hosted path (safe fallback, never throws).
 */
const SUPERSPLAT_VIEWER_BASE = (import.meta.env.VITE_SUPERSPLAT_VIEWER_URL ?? '').trim();

function statusLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeSuperSplatUrl(rawUrl: string): string {
  const embedBase = 'https://superspl.at/s?id=';
  if (rawUrl.startsWith(embedBase)) return rawUrl;
  const sceneMatch = rawUrl.match(/superspl\.at\/scene\/([a-f0-9]+)/i);
  if (sceneMatch) return `${embedBase}${sceneMatch[1]}`;
  return rawUrl;
}

function toEmbedUrl(rawUrl: string, type: string): string {
  if (type === 'supersplat' || type === 'splat_viewer' || type === 'gaussian_splat') {
    return normalizeSuperSplatUrl(rawUrl);
  }
  return rawUrl;
}

/**
 * 25D.1 — Builds the iframe src for a supersplat_self_hosted output asset.
 *
 * Final URL: {SUPERSPLAT_VIEWER_BASE}?content={assetUrl}&noui[&budget=N][&poster=URL][&webgl][&fullload]
 *
 * Returns empty string if VITE_SUPERSPLAT_VIEWER_URL is not configured or
 * if assetUrl is not a safe HTTP(S) URL — never throws.
 */
function toSelfHostedSuperSplatUrl(
  assetUrl: string,
  options?: {
    budget?: number;
    poster?: string;
    webgl?: boolean;
    fullload?: boolean;
  }
): string {
  if (!SUPERSPLAT_VIEWER_BASE || !isSafeHttpUrl(SUPERSPLAT_VIEWER_BASE)) return '';
  if (!assetUrl || !isSafeHttpUrl(assetUrl)) return '';
  try {
    const url = new URL(SUPERSPLAT_VIEWER_BASE);
    url.searchParams.set('content', assetUrl);
    // noui hides SuperSplat's own UI chrome, keeping only the canvas
    url.searchParams.set('noui', '');
    if (options?.budget != null) url.searchParams.set('budget', String(options.budget));
    if (options?.poster && isSafeHttpUrl(options.poster)) url.searchParams.set('poster', options.poster);
    if (options?.webgl) url.searchParams.set('webgl', '');
    if (options?.fullload) url.searchParams.set('fullload', '');
    return url.toString();
  } catch {
    return '';
  }
}

function scrollToViewer(): void {
  document.getElementById('capture-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToLeadForm(): void {
  document.getElementById('capture-lead-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function inferInterestType(value: string): PublicCaptureLeadInput['interestType'] {
  const lower = value.toLowerCase();
  if (lower.includes('visita') || lower.includes('agenda') || lower.includes('reserv')) return 'book_visit';
  if (lower.includes('invers')) return 'investment';
  if (lower.includes('info') || lower.includes('contact')) return 'request_info';
  return 'general';
}

function getProviderLabel(type: string): string {
  if (NATIVE_SPLAT_TYPES.includes(type)) return 'Viewer propio SparkJS';
  if (NATIVE_POINT_CLOUD_TYPES.includes(type)) return 'Viewer propio PLY';
  if (SELF_HOSTED_SPLAT_TYPES.includes(type)) return 'SuperSplat self-hosted';
  if (type === 'supersplat' || type === 'splat_viewer' || type === 'gaussian_splat') return '3D / Gaussian / Splat';
  if (type === 'spark_viewer') return 'Spark viewer';
  if (type === 'external_3d_viewer') return 'Viewer 3D externo';
  return statusLabel(type);
}

function isNativeSplatUrl(rawUrl: string): boolean {
  const supported = ['.ply', '.splat', '.spz', '.ksplat', '.sog', '.json', '.zip', '.rad'];
  try {
    const path = new URL(rawUrl).pathname.toLowerCase();
    return supported.some((extension) => path.endsWith(extension));
  } catch {
    const path = rawUrl.toLowerCase().split('?')[0];
    return supported.some((extension) => path.endsWith(extension));
  }
}

function isPlyUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).pathname.toLowerCase().endsWith('.ply');
  } catch {
    return rawUrl.toLowerCase().split('?')[0].endsWith('.ply');
  }
}

function CaptureBadge({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'success' | 'accent' }): JSX.Element {
  const toneClass = {
    neutral: 'bg-white text-slate-600 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10',
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50',
    accent: 'bg-violet-50 text-ip-accent ring-violet-200 dark:bg-violet-950/30 dark:text-violet-200 dark:ring-violet-800/50'
  }[tone];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ring-1 ${toneClass}`}>
      {children}
    </span>
  );
}

export default function CapturePublicPage(): JSX.Element {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [job, setJob] = useState<PublicCaptureJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [leadForm, setLeadForm] = useState<PublicCaptureLeadInput>({
    name: '',
    email: '',
    phone: '',
    message: '',
    interestType: 'request_info',
    consent: false,
    honeypot: ''
  });
  const [leadStatus, setLeadStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [leadMessage, setLeadMessage] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    isMobileLike: false,
    isLandscape: false,
    isMobileLandscape: false,
    isMobilePortrait: false
  });
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);

  function updateLeadField<K extends keyof PublicCaptureLeadInput>(key: K, value: PublicCaptureLeadInput[K]): void {
    setLeadForm((current) => ({ ...current, [key]: value }));
    if (leadStatus === 'error') {
      setLeadStatus('idle');
      setLeadMessage('');
    }
  }

  function handleHotspotLeadIntent(cta: string): void {
    updateLeadField('interestType', inferInterestType(cta));
    scrollToLeadForm();
  }

  async function copyPublicLink(publicUrl: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setShareMessage('Enlace copiado.');
    } catch {
      setShareMessage('No se pudo copiar el enlace.');
    }
  }

  async function sharePublicLink(publicUrl: string, title: string): Promise<void> {
    if ('share' in navigator) {
      try {
        await navigator.share({ title, url: publicUrl });
        setShareMessage('Enlace compartido.');
        return;
      } catch {
        setShareMessage('');
        return;
      }
    }
    await copyPublicLink(publicUrl);
  }

  async function submitLeadForm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!leadForm.name.trim() || !leadForm.email.trim() || !leadForm.consent) {
      setLeadStatus('error');
      setLeadMessage('No se pudo enviar la solicitud. Revisa los datos e inténtalo de nuevo.');
      return;
    }

    try {
      setLeadStatus('submitting');
      setLeadMessage('');
      const data = await unwrapApiResponse<PublicCaptureLeadResponse>(
        api.post(`/capture-jobs/public/${id}/leads`, leadForm)
      );
      setLeadStatus('success');
      setLeadMessage(data.message);
      setLeadForm({
        name: '',
        email: '',
        phone: '',
        message: '',
        interestType: 'request_info',
        consent: false,
        honeypot: ''
      });
    } catch (err) {
      setLeadStatus('error');
      setLeadMessage(getApiErrorMessage(err) || 'No se pudo enviar la solicitud. Revisa los datos e inténtalo de nuevo.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      setError('CaptureJob no encontrado.');
      setLoading(false);
      return;
    }
    unwrapApiResponse<PublicCaptureJob>(api.get(`/capture-jobs/public/${id}`))
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = () => {
      const width = window.visualViewport?.width ?? window.innerWidth;
      const height = window.visualViewport?.height ?? window.innerHeight;
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
      const isSmallScreen = Math.min(width, height) <= 768;
      const isMobileLike = isTouchDevice && isSmallScreen;
      const isLandscape = width > height;
      setViewport({
        width,
        height,
        isMobileLike,
        isLandscape,
        isMobileLandscape: isMobileLike && isLandscape,
        isMobilePortrait: isMobileLike && !isLandscape
      });
    };
    sync();
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    visualViewport?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveHotspotId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    if (isImmersiveMode || viewport.isMobileLandscape) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isImmersiveMode, viewport.isMobileLandscape]);

  const premiumOutput = useMemo(() => {
    if (!job) return null;
    return [...job.outputAssets]
      .filter((asset) => asset.isPremium3d)
      .sort((a, b) => {
        const ai = PREMIUM_3D_PRIORITY.indexOf(a.type);
        const bi = PREMIUM_3D_PRIORITY.indexOf(b.type);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      })[0] ?? null;
  }, [job]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-5 py-16">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Cargando experiencia...</p>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center px-5 py-16 text-center">
        <Helmet><title>Capture no disponible · Immersphere Pro</title></Helmet>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-500">No disponible</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">Esta entrega no esta publicada</h1>
        <p className="mt-3 max-w-md text-sm font-semibold text-slate-500 dark:text-white/45">{error ?? 'Revisa el enlace o solicita acceso al equipo responsable.'}</p>
        <Link to="/" className="mt-6 rounded-full bg-ip-accent px-5 py-2 text-sm font-black text-white">Volver</Link>
      </main>
    );
  }

  const primaryOutput = premiumOutput ?? job.outputAssets[0] ?? null;
  const primaryUrl = primaryOutput?.url ?? job.publicUrl;
  const applied = job.appliedAiContent;
  const heroTitle = applied?.commercialTitle || job.title;
  const shortDescription = applied?.shortDescription || job.clientName;
  const heroDescription = applied?.salesAngle || applied?.longDescription || shortDescription;
  const primaryCta = applied?.ctaPrimary || 'Solicitar información';
  const secondaryCta = applied?.ctaSecondary || 'Ver experiencia 3D';
  const benefits = applied?.benefits?.filter(Boolean).slice(0, 6) ?? [];
  const isPresentationMode = searchParams.get('present') === '1';
  const isPrintMode = searchParams.get('print') === '1';
  const isMobileViewport = viewport.isMobileLike;
  const isMobileLandscape = viewport.isMobileLandscape;
  const isMobilePortrait = viewport.isMobilePortrait;
  const canEmbedPrimary = Boolean(
    premiumOutput &&
    premiumOutput.embeddable &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl)
  );
  const canRenderNativePrimary = Boolean(
    ENABLE_NATIVE_3D_VIEWER &&
    premiumOutput &&
    NATIVE_POINT_CLOUD_TYPES.includes(premiumOutput.type) &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl) &&
    isPlyUrl(primaryUrl)
  );
  const canRenderNativeSplatPrimary = Boolean(
    ENABLE_NATIVE_SPLAT_VIEWER &&
    premiumOutput &&
    NATIVE_SPLAT_TYPES.includes(premiumOutput.type) &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl) &&
    isNativeSplatUrl(primaryUrl)
  );
  /**
   * 25D.1 — SuperSplat self-hosted path.
   * Does NOT rely on premiumOutput.embeddable (which checks EMBEDDABLE_3D_HOSTS).
   * The iframe src is the viewer URL, not the asset URL directly.
   * Requires: VITE_SUPERSPLAT_VIEWER_URL configured + asset type = supersplat_self_hosted.
   */
  const selfHostedViewerUrl = (
    SUPERSPLAT_VIEWER_BASE &&
    isSafeHttpUrl(SUPERSPLAT_VIEWER_BASE) &&
    premiumOutput &&
    SELF_HOSTED_SPLAT_TYPES.includes(premiumOutput.type) &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl)
  ) ? toSelfHostedSuperSplatUrl(primaryUrl) : '';
  const canRenderSelfHostedPrimary = Boolean(selfHostedViewerUrl);
  const hasPublic3d = Boolean(premiumOutput);
  const providerLabel = premiumOutput ? getProviderLabel(premiumOutput.type) : null;
  const metaDescription = shortDescription || heroDescription || job.clientName;
  const publicUrl = typeof window === 'undefined' ? `/capture/${job.id}` : `${window.location.origin}/capture/${job.id}`;
  const printUrl = `${publicUrl}?print=1`;
  const showSecondarySections = !isMobileLandscape;

  const embeddedViewer = canRenderNativeSplatPrimary ? (
    <NativeGaussianSplatViewer
      assetUrl={primaryUrl}
      hotspots={job.hotspots}
      activeHotspotId={activeHotspotId}
      onHotspotClick={setActiveHotspotId}
      mode="view"
    />
  ) : canRenderNativePrimary ? (
    <NativePointCloudViewer
      assetUrl={primaryUrl}
      hotspots={job.hotspots}
      activeHotspotId={activeHotspotId}
      onHotspotClick={setActiveHotspotId}
      mode="view"
    />
  ) : canRenderSelfHostedPrimary ? (
    // 25D.1 — SuperSplat self-hosted iframe.
    // src = viewer URL with ?content=assetUrl&noui.
    // Hotspots overlay_2d continue working via CaptureViewerShell (above this element).
    <div className="h-full w-full bg-black">
      <iframe
        src={selfHostedViewerUrl}
        title="Experiencia 3D inmersiva — SuperSplat"
        className="h-full w-full border-0"
        allow="fullscreen; xr-spatial-tracking"
        allowFullScreen
        loading="lazy"
      />
    </div>
  ) : (
    <div className="h-full w-full bg-black">
      <iframe
        src={toEmbedUrl(primaryUrl, premiumOutput?.type ?? '')}
        title="Experiencia 3D inmersiva"
        className="h-full w-full border-0"
        allow="fullscreen; xr-spatial-tracking"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );

  const renderEmbeddedViewer = (immersive = false) => (
    <CaptureViewerShell
      viewer={embeddedViewer}
      hotspots={job.hotspots}
      activeHotspotId={activeHotspotId}
      isImmersive={immersive}
      isMobileLike={isMobileViewport}
      isMobileLandscape={isMobileLandscape}
      isMobilePortrait={isMobilePortrait}
      title={heroTitle}
      subtitle={immersive ? heroTitle : statusLabel(premiumOutput?.type ?? 'viewer')}
      ctaLabel={primaryCta}
      externalUrl={primaryUrl}
      showControls={immersive || isMobileLandscape}
      onHotspotClick={setActiveHotspotId}
      onCloseHotspot={() => setActiveHotspotId(null)}
      onEnterImmersive={() => setIsImmersiveMode(true)}
      onExitImmersive={() => setIsImmersiveMode(false)}
    />
  );

  return (
    <>
      <main className={isMobileLandscape ? 'mx-auto max-w-none px-2 py-2' : 'bg-[#F8FAFC] text-slate-950 dark:bg-slate-900 dark:text-slate-100'}>
        <Helmet>
          <title>{heroTitle} · Immersphere Pro</title>
          <meta name="description" content={metaDescription} />
          <meta property="og:title" content={heroTitle} />
          <meta property="og:description" content={metaDescription} />
          <meta name="robots" content="noindex" />
        </Helmet>

        {import.meta.env.DEV ? (
          <output className="sr-only">
            capture viewport debug: mobileLike={String(viewport.isMobileLike)}, landscape={String(viewport.isLandscape)}, mobileLandscape={String(viewport.isMobileLandscape)}, width={Math.round(viewport.width)}, height={Math.round(viewport.height)}
          </output>
        ) : null}

        {!isMobileLandscape ? (
          <section className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
            <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-14">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-ip-accent">Entrega visual publicada</p>
                <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white md:text-6xl">{heroTitle}</h1>
                <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-slate-600 dark:text-white/55">{shortDescription}</p>
                {applied?.salesAngle ? <p className="mt-4 max-w-3xl text-sm font-black leading-6 text-ip-accent">{applied.salesAngle}</p> : null}
                <div className="mt-6 flex flex-wrap gap-2">
                  <CaptureBadge tone="success">{statusLabel(job.status)}</CaptureBadge>
                  <CaptureBadge>{statusLabel(job.projectType)}</CaptureBadge>
                  <CaptureBadge>{statusLabel(job.vertical)}</CaptureBadge>
                  {providerLabel ? <CaptureBadge tone="accent">{providerLabel}</CaptureBadge> : null}
                  {premiumOutput?.viewerReady ? <CaptureBadge tone="success">Desktop OK</CaptureBadge> : null}
                  {premiumOutput?.mobileReady ? <CaptureBadge tone="success">Mobile OK</CaptureBadge> : null}
                </div>
              </div>

              <div className="rounded-ip-card border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Siguiente acción</p>
                <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{primaryCta}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-white/50">{heroDescription}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <button type="button" onClick={scrollToLeadForm} className="rounded-full bg-ip-accent px-5 py-3 text-sm font-black text-white transition hover:bg-ip-accent-hover">
                    {primaryCta}
                  </button>
                  <button type="button" onClick={scrollToViewer} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    {secondaryCta} <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => { void sharePublicLink(publicUrl, heroTitle); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    Compartir <Share2 className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => { void copyPublicLink(publicUrl); }} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    Copiar enlace <Copy className="h-4 w-4" />
                  </button>
                  <a href={printUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    Ficha <Printer className="h-4 w-4" />
                  </a>
                </div>
                {shareMessage ? <p className="mt-3 text-xs font-black text-ip-accent">{shareMessage}</p> : null}
              </div>
            </div>
          </section>
        ) : null}

        {isPrintMode && !isMobileLandscape ? (
          <section className="mx-auto max-w-6xl px-5 py-6">
            <div className="grid gap-5 rounded-ip-card bg-white p-6 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border md:grid-cols-[1fr_auto]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ip-accent">Ficha imprimible</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{heroTitle}</h2>
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500 dark:text-white/50">{heroDescription}</p>
                <p className="mt-4 break-all rounded-xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-600 dark:bg-white/5 dark:text-white/60">{publicUrl}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-slate-950">
                    <Printer className="h-3.5 w-3.5" /> Imprimir
                  </button>
                  <button type="button" onClick={() => { void copyPublicLink(publicUrl); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 dark:border-white/10 dark:text-white/70">
                    <Copy className="h-3.5 w-3.5" /> Copiar enlace
                  </button>
                </div>
              </div>
              {job.qrUrl ? <img src={job.qrUrl} alt="QR de la experiencia" className="h-36 w-36 rounded-xl bg-white object-contain p-2 ring-1 ring-slate-200" /> : null}
            </div>
          </section>
        ) : null}

        <section id="capture-viewer" className={isMobileLandscape ? 'mt-0' : 'mx-auto max-w-7xl px-5 py-8 md:py-12 lg:px-6'}>
          {premiumOutput ? (
            <div className={isMobileLandscape ? '' : 'overflow-hidden rounded-ip-card bg-slate-950 text-white shadow-2xl ring-1 ring-slate-800 dark:bg-black dark:ring-white/10'}>
              {!isMobileLandscape ? (
                <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">Experiencia 3D inmersiva</p>
                    <h2 className="mt-1 text-2xl font-black">{statusLabel(premiumOutput.type)}</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {providerLabel ? <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-100 ring-1 ring-violet-300/30">{providerLabel}</span> : null}
                      {premiumOutput.viewerReady ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Desktop OK</span> : null}
                      {premiumOutput.mobileReady ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Mobile OK</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button type="button" onClick={scrollToLeadForm} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                      {primaryCta} <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setIsImmersiveMode(true)} className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">
                      Modo inmersivo
                    </button>
                  </div>
                </div>
              ) : null}

              {canRenderNativeSplatPrimary || canRenderNativePrimary || canRenderSelfHostedPrimary || canEmbedPrimary ? (
                renderEmbeddedViewer()
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 bg-slate-900 px-5 py-10 text-center">
                  <p className="max-w-md text-sm font-semibold text-white/60">Este viewer 3D se abre en una pestaña externa para mantener la entrega segura.</p>
                  <a href={primaryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-black text-white hover:bg-violet-400">
                    Abrir experiencia 3D <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-ip-card bg-white p-8 text-center ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Experiencia visual</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">La experiencia visual todavía no está disponible.</h2>
              {primaryUrl ? (
                <a href={primaryUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                  Abrir enlace publicado <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          )}
        </section>

        {showSecondarySections ? (
          <>
            {!isPresentationMode && benefits.length > 0 ? (
              <section className="mx-auto max-w-6xl px-5 py-6">
                <div className="mb-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-ip-accent">Beneficios clave</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Motivos para avanzar</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {benefits.map((benefit) => (
                    <article key={benefit} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
                      <CheckCircle2 className="h-5 w-5 text-ip-accent" />
                      <p className="mt-3 text-sm font-black leading-6 text-slate-700 dark:text-white/75">{benefit}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!isPresentationMode && job.hotspots.length > 0 ? (
              <section className="mx-auto max-w-6xl px-5 py-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-ip-accent">Puntos destacados</p>
                    <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Puntos destacados de la experiencia</h2>
                    <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-white/45">Explora las zonas y acciones principales de la entrega.</p>
                  </div>
                  <button type="button" onClick={scrollToViewer} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 hover:bg-white dark:border-white/10 dark:text-white/60 dark:hover:bg-white/10">
                    Ver sobre el viewer
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {job.hotspots.map((hotspot) => (
                    <article key={hotspot.id} className="rounded-xl bg-white p-5 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-950 dark:text-white">{hotspot.label}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:bg-white/10 dark:text-white/50">{hotspot.priority}</span>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-ip-accent dark:bg-violet-950/30 dark:text-violet-200">{statusLabel(hotspot.hotspotType)}</span>
                      </div>
                      {hotspot.roomOrZone ? <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{hotspot.roomOrZone}</p> : null}
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-white/50">{hotspot.description}</p>
                      {hotspot.cta ? (
                        <button type="button" onClick={() => handleHotspotLeadIntent(hotspot.cta)} className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-black text-white dark:bg-white dark:text-slate-950">
                          {hotspot.cta}
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {!isPresentationMode ? (
            <section className="mx-auto max-w-6xl px-5 py-6">
              <div className="grid gap-4 rounded-ip-card bg-slate-950 p-6 text-white ring-1 ring-slate-800 md:grid-cols-[0.8fr_1.2fr] md:p-8">
                <div>
                  <ShieldCheck className="h-7 w-7 text-violet-300" />
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-violet-300">Confianza técnica</p>
                  <h2 className="mt-2 text-3xl font-black">Entrega preparada para revisión comercial</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="rounded-xl bg-white/10 p-4 text-sm font-bold text-white/75">Viewer 3D publicado: {hasPublic3d ? 'sí' : 'pendiente'}</p>
                  <p className="rounded-xl bg-white/10 p-4 text-sm font-bold text-white/75">Compatibilidad desktop: {premiumOutput?.viewerReady ? 'validada' : 'pendiente de revisión'}</p>
                  <p className="rounded-xl bg-white/10 p-4 text-sm font-bold text-white/75">Compatibilidad móvil: {premiumOutput?.mobileReady ? 'validada' : 'pendiente de revisión'}</p>
                  <p className="rounded-xl bg-white/10 p-4 text-sm font-bold text-white/75">Hotspots publicados: {job.hotspots.length}</p>
                  <p className="rounded-xl bg-white/10 p-4 text-sm font-bold text-white/75">Landing compartible: activa</p>
                  <p className="rounded-xl bg-white/10 p-4 text-sm font-bold text-white/75">Material original: no se muestra en la entrega pública</p>
                </div>
              </div>
            </section>
            ) : null}

            <section id="capture-lead-form" className="mx-auto max-w-6xl px-5 py-8 pb-14">
              <div className="grid gap-6 rounded-ip-card bg-white p-6 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border md:grid-cols-[0.8fr_1.2fr] md:p-10">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-ip-accent">Conversión</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">¿Quieres recibir más información?</h2>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-white/50">Explora la experiencia 3D y solicita información para avanzar con una visita cualificada.</p>
                  <button type="button" onClick={scrollToViewer} className="mt-6 rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    Volver a ver la experiencia 3D
                  </button>
                </div>

                <form onSubmit={submitLeadForm} className="grid gap-4" noValidate>
                  <input
                    type="text"
                    name="website"
                    value={leadForm.honeypot ?? ''}
                    onChange={(event) => updateLeadField('honeypot', event.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-black text-slate-700 dark:text-white/70">
                      Nombre
                      <input value={leadForm.name} onChange={(event) => updateLeadField('name', event.target.value)} required className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-ip-accent dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-slate-700 dark:text-white/70">
                      Email
                      <input type="email" value={leadForm.email} onChange={(event) => updateLeadField('email', event.target.value)} required className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-ip-accent dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-black text-slate-700 dark:text-white/70">
                      Teléfono opcional
                      <input value={leadForm.phone ?? ''} onChange={(event) => updateLeadField('phone', event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-ip-accent dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </label>
                    <label className="grid gap-2 text-sm font-black text-slate-700 dark:text-white/70">
                      Tipo de interés
                      <select value={leadForm.interestType ?? 'general'} onChange={(event) => updateLeadField('interestType', event.target.value as PublicCaptureLeadInput['interestType'])} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-ip-accent dark:border-white/10 dark:bg-black/20 dark:text-white">
                        <option value="request_info">Solicitar información</option>
                        <option value="book_visit">Reservar visita</option>
                        <option value="investment">Inversión</option>
                        <option value="general">Consulta general</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-black text-slate-700 dark:text-white/70">
                    Mensaje opcional
                    <textarea value={leadForm.message ?? ''} onChange={(event) => updateLeadField('message', event.target.value)} rows={4} maxLength={1000} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-ip-accent dark:border-white/10 dark:bg-black/20 dark:text-white" />
                  </label>
                  <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600 dark:bg-white/5 dark:text-white/55">
                    <input type="checkbox" checked={leadForm.consent} onChange={(event) => updateLeadField('consent', event.target.checked)} required className="mt-1 h-4 w-4 rounded border-slate-300 text-ip-accent" />
                    <span>Acepto que Immersphere Pro gestione esta solicitud y que el equipo responsable pueda contactarme.</span>
                  </label>
                  {leadMessage ? (
                    <p className={`rounded-xl px-4 py-3 text-sm font-black ${leadStatus === 'success' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}>
                      {leadMessage}
                    </p>
                  ) : null}
                  <button type="submit" disabled={leadStatus === 'submitting'} className="rounded-full bg-ip-accent px-6 py-3 text-sm font-black text-white transition hover:bg-ip-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
                    {leadStatus === 'submitting' ? 'Enviando...' : primaryCta}
                  </button>
                </form>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {isImmersiveMode && (canRenderNativeSplatPrimary || canRenderNativePrimary || canRenderSelfHostedPrimary || canEmbedPrimary) ? renderEmbeddedViewer(true) : null}
    </>
  );
}
