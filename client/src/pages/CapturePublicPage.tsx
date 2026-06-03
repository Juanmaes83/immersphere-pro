import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import CaptureViewerShell from '@/components/capture/CaptureViewerShell';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { PublicCaptureJob } from '@/types/api';

const PREMIUM_3D_PRIORITY = ['gaussian_splat', 'splat_viewer', 'supersplat', 'spark_viewer', 'external_3d_viewer'];

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

function scrollToViewer(): void {
  document.getElementById('capture-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getProviderLabel(type: string): string {
  if (type === 'supersplat' || type === 'splat_viewer' || type === 'gaussian_splat') return '3D / Gaussian / Splat';
  if (type === 'spark_viewer') return 'Spark viewer';
  if (type === 'external_3d_viewer') return 'Viewer 3D externo';
  return statusLabel(type);
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
  const [job, setJob] = useState<PublicCaptureJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    isMobileLike: false,
    isLandscape: false,
    isMobileLandscape: false,
    isMobilePortrait: false
  });
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);

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
  const isMobileViewport = viewport.isMobileLike;
  const isMobileLandscape = viewport.isMobileLandscape;
  const isMobilePortrait = viewport.isMobilePortrait;
  const canEmbedPrimary = Boolean(
    premiumOutput &&
    premiumOutput.embeddable &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl)
  );
  const hasPublic3d = Boolean(premiumOutput);
  const providerLabel = premiumOutput ? getProviderLabel(premiumOutput.type) : null;
  const metaDescription = shortDescription || heroDescription || job.clientName;

  const embeddedViewer = (
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
                  <button type="button" onClick={scrollToViewer} className="rounded-full bg-ip-accent px-5 py-3 text-sm font-black text-white transition hover:bg-ip-accent-hover">
                    {primaryCta}
                  </button>
                  <button type="button" onClick={scrollToViewer} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-white dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    {secondaryCta} <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section id="capture-viewer" className={isMobileLandscape ? 'mt-0' : 'mx-auto max-w-6xl px-5 py-8 md:py-12'}>
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
                    <a href={primaryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                      {primaryCta} <ExternalLink className="h-4 w-4" />
                    </a>
                    <button type="button" onClick={() => setIsImmersiveMode(true)} className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">
                      Modo inmersivo
                    </button>
                  </div>
                </div>
              ) : null}

              {canEmbedPrimary ? (
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

        {!isMobileLandscape ? (
          <>
            {benefits.length > 0 ? (
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

            {job.hotspots.length > 0 ? (
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
                      {hotspot.cta ? <p className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-center text-sm font-black text-white dark:bg-white dark:text-slate-950">{hotspot.cta}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

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

            <section className="mx-auto max-w-6xl px-5 py-8 pb-14">
              <div className="rounded-ip-card bg-white p-6 text-center ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border md:p-10">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ip-accent">Conversión</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">¿Quieres recibir más información?</h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500 dark:text-white/50">Explora la experiencia 3D y solicita información para avanzar con una visita cualificada.</p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button type="button" onClick={scrollToViewer} className="rounded-full bg-ip-accent px-6 py-3 text-sm font-black text-white transition hover:bg-ip-accent-hover">
                    {primaryCta}
                  </button>
                  <button type="button" onClick={scrollToViewer} className="rounded-full border border-slate-200 px-6 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/10">
                    Volver a ver la experiencia 3D
                  </button>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {isImmersiveMode && canEmbedPrimary ? renderEmbeddedViewer(true) : null}
    </>
  );
}
