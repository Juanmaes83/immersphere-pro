import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { api, getApiErrorMessage, unwrapApiResponse } from '@/services/api';
import type { PublicCaptureJob } from '@/types/api';

const PREMIUM_3D_PRIORITY = ['gaussian_splat', 'splat_viewer', 'supersplat', 'spark_viewer', 'external_3d_viewer'];
const AUTO_HOTSPOT_POSITIONS = [
  { x: 20, y: 30 },
  { x: 75, y: 30 },
  { x: 30, y: 70 },
  { x: 70, y: 70 },
  { x: 50, y: 50 }
];

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

function getPercentPosition(position: Record<string, unknown> | null, key: string): number | null {
  const value = position?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function getHotspotPosition(hotspot: PublicCaptureJob['hotspots'][number], index: number): { x: number; y: number; mobileX: number; mobileY: number } {
  const fallback = AUTO_HOTSPOT_POSITIONS[index % AUTO_HOTSPOT_POSITIONS.length];
  const x = getPercentPosition(hotspot.position, 'x') ?? fallback.x;
  const y = getPercentPosition(hotspot.position, 'y') ?? fallback.y;
  return {
    x,
    y,
    mobileX: getPercentPosition(hotspot.position, 'mobileX') ?? x,
    mobileY: getPercentPosition(hotspot.position, 'mobileY') ?? y
  };
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
    if (isImmersiveMode) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isImmersiveMode]);

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

  const premiumOutput = [...job.outputAssets]
    .filter((asset) => asset.isPremium3d)
    .sort((a, b) => {
      const ai = PREMIUM_3D_PRIORITY.indexOf(a.type);
      const bi = PREMIUM_3D_PRIORITY.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })[0] ?? null;
  const primaryOutput = premiumOutput ?? job.outputAssets[0] ?? null;
  const primaryUrl = primaryOutput?.url ?? job.publicUrl;
  const applied = job.appliedAiContent;
  const heroTitle = applied?.commercialTitle || job.title;
  const heroDescription = applied?.shortDescription || applied?.longDescription || job.clientName;
  const primaryCta = applied?.ctaPrimary || 'Solicitar información';
  const activeHotspot = job.hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? null;
  const isMobileViewport = viewport.isMobileLike;
  const isLandscape = viewport.isLandscape;
  const isMobileLandscape = viewport.isMobileLandscape;
  const isMobilePortrait = viewport.isMobilePortrait;
  const canEmbedPrimary = Boolean(
    premiumOutput &&
    premiumOutput.embeddable &&
    primaryUrl &&
    isSafeHttpUrl(primaryUrl)
  );
  const normalViewerClass = isMobileLandscape
    ? 'h-[92dvh] min-h-[360px] w-full'
    : isMobileViewport
      ? 'h-[60dvh] min-h-[420px] w-full'
      : 'aspect-[16/10] min-h-[320px]';

  const renderHotspotOverlay = (immersive = false) => job.hotspots.length > 0 ? (
    <div className="pointer-events-none absolute inset-0">
      {job.hotspots.map((hotspot, index) => {
        const position = getHotspotPosition(hotspot, index);
        const left = viewport.isMobileLike ? position.mobileX : position.x;
        const top = viewport.isMobileLike ? position.mobileY : position.y;
        const isActive = activeHotspotId === hotspot.id;
        return (
          <button
            key={hotspot.id}
            type="button"
            aria-label={`Ver hotspot ${hotspot.label}`}
            onClick={() => setActiveHotspotId(hotspot.id)}
            className={`pointer-events-auto absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-black shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-4 ring-black/20 transition hover:scale-110 focus:outline-none focus:ring-4 focus:ring-violet-300 sm:h-9 sm:w-9 ${isActive ? 'bg-ip-accent text-white' : 'bg-white text-slate-950 hover:bg-violet-100'}`}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {index + 1}
          </button>
        );
      })}
      {activeHotspot ? (
        <div className={`pointer-events-auto absolute rounded-xl bg-white p-4 text-slate-950 shadow-2xl ring-1 ring-slate-200 ${immersive || isMobileLandscape ? 'inset-x-3 bottom-3 max-h-[34dvh] overflow-auto' : isMobileViewport ? 'inset-x-3 bottom-3 max-h-[42dvh] overflow-auto' : 'right-4 top-4 w-80'}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ip-accent">{activeHotspot.roomOrZone || statusLabel(activeHotspot.hotspotType)}</p>
              <h3 className="mt-1 text-base font-black">{activeHotspot.label}</h3>
            </div>
            <button type="button" onClick={() => setActiveHotspotId(null)} className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-black text-slate-500 hover:bg-slate-50">
              Cerrar
            </button>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{activeHotspot.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{activeHotspot.priority}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">{statusLabel(activeHotspot.hotspotType)}</span>
          </div>
          {activeHotspot.cta ? (
            <button type="button" className="mt-4 w-full rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
              {activeHotspot.cta}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const renderEmbeddedViewer = (immersive = false) => (
    <div className={`relative bg-black ${immersive ? 'h-[calc(100dvh-64px)] min-h-0 w-screen' : normalViewerClass}`}>
      <iframe
        src={toEmbedUrl(primaryUrl, premiumOutput?.type ?? '')}
        title="Experiencia 3D inmersiva"
        className="h-full w-full border-0"
        allow="fullscreen; xr-spatial-tracking"
        loading="lazy"
      />
      {renderHotspotOverlay(immersive)}
    </div>
  );

  return (
    <>
    <main className={`mx-auto ${isMobileLandscape ? 'max-w-none px-2 py-2' : 'max-w-5xl px-5 py-12'}`}>
      <Helmet>
        <title>{job.title} · Immersphere Pro</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {import.meta.env.DEV ? (
        <output className="sr-only">
          capture viewport debug: mobileLike={String(viewport.isMobileLike)}, landscape={String(viewport.isLandscape)}, mobileLandscape={String(viewport.isMobileLandscape)}, width={Math.round(viewport.width)}, height={Math.round(viewport.height)}
        </output>
      ) : null}

      <section className={`border-b border-slate-200 dark:border-white/10 ${isMobileLandscape ? 'sr-only' : 'pb-8'}`}>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-ip-accent">Entrega visual publicada</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 dark:text-white">{heroTitle}</h1>
        <p className="mt-3 max-w-3xl text-lg font-semibold leading-8 text-slate-500 dark:text-white/45">{heroDescription}</p>
        {applied?.salesAngle ? <p className="mt-3 max-w-3xl text-sm font-black text-ip-accent">{applied.salesAngle}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/50">{statusLabel(job.status)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10">{job.projectType}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10">{job.vertical}</span>
        </div>
        {applied?.benefits?.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {applied.benefits.slice(0, 5).map((benefit) => (
              <span key={benefit} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-white/5 dark:text-white/60 dark:ring-white/10">{benefit}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className={`${isMobileLandscape ? 'mt-0 grid gap-2' : 'mt-8 grid gap-4'}`}>
        {premiumOutput ? (
          <div className={`overflow-hidden bg-slate-950 text-white ring-1 ring-slate-800 dark:bg-black dark:ring-white/10 ${isMobileLandscape ? 'rounded-xl' : 'rounded-ip-card'}`}>
            <div className={`flex gap-4 border-b border-white/10 md:flex-row md:items-center md:justify-between ${isMobileLandscape ? 'items-center justify-between px-3 py-2' : 'flex-col px-5 py-4'}`}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">Experiencia 3D inmersiva</p>
                <h2 className={`${isMobileLandscape ? 'text-base' : 'mt-1 text-2xl'} font-black`}>{statusLabel(premiumOutput.type)}</h2>
                <div className={`${isMobileLandscape ? 'hidden' : 'mt-3 flex'} flex-wrap gap-2`}>
                  <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-violet-100 ring-1 ring-violet-300/30">3D / Gaussian / Splat</span>
                  {premiumOutput.viewerReady ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Desktop OK</span> : null}
                  {premiumOutput.mobileReady ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Mobile OK</span> : null}
                </div>
              </div>
              {isMobileLandscape ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 ring-1 ring-emerald-300/30">Modo horizontal activo</span> : null}
              <a href={primaryUrl} target="_blank" rel="noreferrer" className={`${isMobileLandscape ? 'hidden' : 'inline-flex'} items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100`}>
                {primaryCta} <ExternalLink className="h-4 w-4" />
              </a>
              <button type="button" onClick={() => setIsImmersiveMode(true)} className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">
                Modo inmersivo
              </button>
            </div>
            {isMobilePortrait ? (
              <div className="border-b border-white/10 bg-violet-500/15 px-5 py-4">
                <p className="text-sm font-black text-white">Gira el móvil para ver la experiencia en formato inmersivo.</p>
                <p className="mt-1 text-xs font-semibold text-white/60">En horizontal verás mejor estancias, proporciones, splats, panorámicas y vídeos inmersivos.</p>
                <button type="button" onClick={() => setIsImmersiveMode(true)} className="mt-3 rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950">
                  Modo inmersivo
                </button>
              </div>
            ) : null}
            {canEmbedPrimary ? (
              renderEmbeddedViewer()
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 bg-slate-900 px-5 py-10 text-center">
                <p className="max-w-md text-sm font-semibold text-white/60">Este viewer 3D se abre en una pestaña externa para mantener la entrega segura.</p>
                <a href={primaryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-5 py-3 text-sm font-black text-white hover:bg-violet-400">
                  Abrir experiencia 3D <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        ) : primaryUrl ? (
          <a href={primaryUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-ip-card bg-slate-950 px-5 py-4 text-white dark:bg-white dark:text-slate-950">
            <span className="font-black">Abrir experiencia publicada</span>
            <ExternalLink className="h-5 w-5" />
          </a>
        ) : null}

        {job.hotspots.length > 0 ? (
          <section className="rounded-ip-card bg-white p-5 ring-1 ring-slate-200 dark:bg-ip-card dark:ring-ip-card-border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ip-accent">Puntos destacados</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Hotspots publicados</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-white/45">También aparecen como puntos interactivos sobre la experiencia 3D cuando el viewer está embebido.</p>
              </div>
              {applied?.ctaPrimary ? <p className="text-sm font-black text-slate-500 dark:text-white/50">{applied.ctaPrimary}</p> : null}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {job.hotspots.map((hotspot) => (
                <article key={hotspot.id} className="rounded-xl border border-slate-100 p-4 dark:border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-slate-950 dark:text-white">{hotspot.label}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 dark:bg-white/10 dark:text-white/50">{hotspot.priority}</span>
                  </div>
                  {hotspot.roomOrZone ? <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-slate-400">{hotspot.roomOrZone}</p> : null}
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-white/50">{hotspot.description}</p>
                  {hotspot.cta ? <p className="mt-3 text-sm font-black text-ip-accent">{hotspot.cta}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {job.outputAssets.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {job.outputAssets.filter((asset) => asset.id !== premiumOutput?.id).map((asset) => (
              <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="rounded-ip-card bg-white p-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg dark:bg-ip-card dark:ring-ip-card-border">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{asset.type}</p>
                <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{asset.format || 'url'}</p>
                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-white/45">
                  {asset.viewerReady ? 'Viewer listo' : 'Viewer pendiente'} · {asset.mobileReady ? 'Movil listo' : 'Movil pendiente'}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <p className="rounded-ip-card bg-white p-6 text-sm font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-ip-card dark:text-white/45 dark:ring-ip-card-border">
            La entrega esta publicada, pero aun no tiene outputs publicos vinculados.
          </p>
        )}
      </section>
    </main>
    {isImmersiveMode && canEmbedPrimary ? (
      <div className="fixed inset-0 z-[80] h-[100dvh] bg-black text-white">
        <div className="flex h-16 items-center justify-between gap-3 border-b border-white/10 px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{heroTitle}</p>
            {isMobilePortrait ? <p className="mt-1 text-xs font-semibold text-white/55">Para mejor experiencia, gira el móvil.</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={primaryUrl} target="_blank" rel="noreferrer" className="hidden rounded-full border border-white/15 px-3 py-2 text-xs font-black text-white/80 hover:bg-white/10 sm:inline-flex">
              Abrir externo
            </a>
            <button type="button" onClick={() => setIsImmersiveMode(false)} className="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950">
              Salir
            </button>
          </div>
        </div>
        {renderEmbeddedViewer(true)}
      </div>
    ) : null}
    </>
  );
}
