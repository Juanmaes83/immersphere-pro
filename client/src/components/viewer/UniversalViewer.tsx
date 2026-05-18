import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import DollhouseViewer from '@/components/viewer/DollhouseViewer';
import FloorplanViewer from '@/components/viewer/FloorplanViewer';
import GaussianSplatViewer from '@/components/viewer/GaussianSplatViewer';
import LeadCaptureModal from '@/components/viewer/LeadCaptureModal';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';

const GlbViewer = lazy(() => import('@/components/viewer/GlbViewer'));
import { AUTH_STORAGE_KEYS } from '@/services/api';
import type {
  Hotspot,
  Space,
  SpacePreview,
  UniversalViewerProps,
  ViewerAsset,
  ViewerAssetType,
  ViewerEvent
} from '@/types/viewer';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'
).replace(/\/$/, '');

function trackToBackend(payload: Record<string, unknown>): void {
  const token = window.localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  fetch(`${API_BASE}/analytics/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function createViewerEvent(
  type: ViewerEvent['type'],
  data: {
    spaceId?: string;
    assetId?: string;
    hotspotId?: string;
    data?: Record<string, unknown>;
  }
): ViewerEvent {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: Date.now(),
    spaceId: data.spaceId,
    assetId: data.assetId,
    hotspotId: data.hotspotId,
    data: data.data
  };
}

function sortSpaces(spaces: Space[]): Space[] {
  return [...spaces].sort((a, b) => a.order - b.order);
}

function selectPrimaryAsset(space: Space | undefined, preferredType?: ViewerAssetType): ViewerAsset | null {
  if (!space?.assets.length) return null;

  if (preferredType) {
    const preferredAsset = space.assets.find((asset) => asset.type === preferredType);
    if (preferredAsset) return preferredAsset;
  }

  const panoramaAsset = space.assets.find((asset) => asset.type === 'panorama_360');
  if (panoramaAsset) return panoramaAsset;

  const splatAsset = space.assets.find((asset) => asset.type === 'gaussian_splat');
  if (splatAsset) return splatAsset;

  return space.assets[0] ?? null;
}

/** Returns the body of the first info-type hotspot in a space, or null. */
function getSpaceDescription(space: Space): string | null {
  for (const asset of space.assets) {
    for (const hotspot of asset.hotspots ?? []) {
      if (hotspot.type === 'info' && hotspot.body) {
        return hotspot.body;
      }
    }
  }
  return null;
}

/** Formats non-null space dimensions as a human-readable string, or null. */
function formatSpaceDimensions(dims: Space['dimensions']): string | null {
  if (!dims) return null;
  const parts: string[] = [];
  if (dims.width != null)  parts.push(`ancho ${dims.width} m`);
  if (dims.height != null) parts.push(`altura ${dims.height} m`);
  if (dims.depth != null)  parts.push(`fondo ${dims.depth} m`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ── Error boundary ──────────────────────────────────────────────────────────

interface EBState { hasError: boolean; error: Error | null }
interface EBProps  { children: ReactNode }

class ViewerErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ViewerErrorBoundary]', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-[1.5rem] bg-slate-800 p-6 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="text-sm font-black text-white">Error al cargar el visor</p>
          <p className="text-xs text-white/50">No pudimos cargar el visor. Inténtalo de nuevo.</p>
          <button
            type="button"
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/70 transition hover:bg-white/20"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function UniversalViewer({
  propertyId,
  spaces,
  initialSpaceId,
  primaryColor = '#7C3AED',
  removeBranding = false,
  className = '',
  propertyTitle,
  agencyName,
  floorplanUrl,
  onAnalyticsEvent
}: UniversalViewerProps): JSX.Element {
  const sortedSpaces = useMemo(() => sortSpaces(spaces), [spaces]);
  const firstSpaceId = sortedSpaces[0]?.id ?? '';

  const spacePreviewMap = useMemo<Record<string, SpacePreview>>(() =>
    Object.fromEntries(sortedSpaces.map((s) => [
      s.id,
      {
        name: s.name,
        thumbnail: s.assets[0]?.thumbnail ?? null,
        assetType: s.assets[0]?.type ?? 'panorama_360'
      } satisfies SpacePreview
    ])),
  [sortedSpaces]);

  const [activeSpaceId, setActiveSpaceId] = useState(initialSpaceId ?? firstSpaceId);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // ── Guided tour ─────────────────────────────────────────────────────────────
  const [isGuidedTour, setIsGuidedTour]     = useState(false);
  const [guidedTourIdx, setGuidedTourIdx]   = useState(0);

  // ── Other viewer modes ───────────────────────────────────────────────────────
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [isMeasuring,   setIsMeasuring]   = useState(false);
  const [showDollhouse, setShowDollhouse] = useState(false);
  const [showTools,     setShowTools]     = useState(false); // advanced tools menu (···)

  // ── Branded loading screen ───────────────────────────────────────────────────
  const [showBrandedLoading, setShowBrandedLoading] = useState(true);
  const [loadingVisible,     setLoadingVisible]     = useState(true);
  const [progressStarted,    setProgressStarted]    = useState(false);

  // ── Cinematic transitions ────────────────────────────────────────────────────
  type TPhase = 'idle' | 'out' | 'in';
  const [tPhase, setTPhase]                               = useState<TPhase>('idle');
  const [prefersReducedMotion, setPrefersReducedMotion]   = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const transitionLock  = useRef(false);
  const pendingSpaceRef = useRef<string | null>(null);
  const pendingSwapRef  = useRef<(() => void) | null>(null);
  const isTouchDevice   = useRef(window.matchMedia('(pointer: coarse)').matches);

  const viewerRef  = useRef<HTMLElement>(null);
  const sessionId  = useRef(`s-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  // ── Storytelling mode ────────────────────────────────────────────────────────
  const [storyMode,    setStoryMode]    = useState(true);
  const [storyVisible, setStoryVisible] = useState(false);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cinematic tour ───────────────────────────────────────────────────────────
  const CINEMATIC_MS = 10_000; // 10s per space — no per-space config yet
  const [isCinematic,      setIsCinematic]      = useState(false);
  const [cinematicPaused,  setCinematicPaused]  = useState(false);
  const [showCinematicEnd, setShowCinematicEnd] = useState(false);
  const [cpTick,           setCpTick]           = useState(false); // drives progress animation
  const cinematicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Ambient audio engine ─────────────────────────────────────────────────────
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const audioMutedRef  = useRef(false);
  const fadeOutRafId   = useRef(0);
  const fadeInRafId    = useRef(0);
  const [audioMuted,   setAudioMuted]   = useState(false);
  const [audioReady,   setAudioReady]   = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const activeSpace = sortedSpaces.find((space) => space.id === activeSpaceId) ?? sortedSpaces[0];
  const activeAsset = selectPrimaryAsset(activeSpace);

  // Track initial viewer open
  useEffect(() => {
    if (!activeSpace) return;
    trackToBackend({
      propertyId,
      spaceId: activeSpace.id,
      type: 'viewer_open',
      sessionId: sessionId.current
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fullscreen listener
  useEffect(() => {
    function onFullscreenChange(): void {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Branded loading: start progress bar after first paint, then fade out
  useEffect(() => {
    // Tiny delay so the browser paints width:0 before transitioning to 100%
    const startProgress = setTimeout(() => { setProgressStarted(true); }, 60);
    // Begin fade-out at 1.8s (progress bar reaches ~100% at 1.66s)
    const startFade     = setTimeout(() => { setLoadingVisible(false); }, 1800);
    // Remove the DOM node entirely after the 500ms fade completes
    const removeDom     = setTimeout(() => { setShowBrandedLoading(false); }, 2350);
    return () => {
      clearTimeout(startProgress);
      clearTimeout(startFade);
      clearTimeout(removeDom);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync prefers-reduced-motion when the OS setting changes mid-session
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    function onChange(e: MediaQueryListEvent): void { setPrefersReducedMotion(e.matches); }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Mobile bottom sheet: open when a hotspot is set on a touch device
  useEffect(() => {
    if (isTouchDevice.current && activeHotspot) {
      setMobileSheetOpen(true);
    } else {
      setMobileSheetOpen(false);
    }
  }, [activeHotspot]);

  // Micro-parallax: follow cursor on desktop only, update CSS vars directly on the section el
  useEffect(() => {
    if (prefersReducedMotion || isTouchDevice.current) return;
    let rafId = 0;
    function onMouseMove(e: MouseEvent): void {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = viewerRef.current;
        if (!el) return;
        const x = (e.clientX / window.innerWidth  - 0.5) * 8;
        const y = (e.clientY / window.innerHeight - 0.5) * 4;
        el.style.setProperty('--px', `${x}px`);
        el.style.setProperty('--py', `${y}px`);
      });
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  // Storytelling overlay: show on space enter, auto-dismiss after 4s
  useEffect(() => {
    if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
    const hasContent = !!(activeSpace?.storySubheadline || activeSpace?.storyHighlight);
    if (!storyMode || !hasContent) {
      setStoryVisible(false);
      return;
    }
    setStoryVisible(true);
    storyTimerRef.current = setTimeout(() => { setStoryVisible(false); }, 4000);
    return () => { if (storyTimerRef.current) clearTimeout(storyTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpace?.id, storyMode]);

  // Sync muted ref so the audio effect closure can read the latest value without re-triggering
  useEffect(() => {
    audioMutedRef.current = audioMuted;
    if (audioRef.current) audioRef.current.muted = audioMuted;
  }, [audioMuted]);

  // Ambient audio crossfade — activates only after first user interaction
  useEffect(() => {
    if (!audioEnabled) return;

    const FADE_MS = prefersReducedMotion ? 150 : 800;
    const TARGET_VOL = 0.28;
    const url = activeSpace?.ambientAudio;

    // Cancel any in-progress fades
    cancelAnimationFrame(fadeOutRafId.current);
    cancelAnimationFrame(fadeInRafId.current);

    // Fade out and release old audio
    const oldAudio = audioRef.current;
    if (oldAudio) {
      const startVol = oldAudio.volume;
      const t0 = performance.now();
      const doFadeOut = (now: number): void => {
        const p = Math.min((now - t0) / FADE_MS, 1);
        oldAudio.volume = startVol * (1 - p);
        if (p < 1) {
          fadeOutRafId.current = requestAnimationFrame(doFadeOut);
        } else {
          oldAudio.pause();
          oldAudio.src = '';
        }
      };
      fadeOutRafId.current = requestAnimationFrame(doFadeOut);
      audioRef.current = null;
    }

    if (!url) {
      setAudioReady(false);
      return;
    }

    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0;
    audio.muted = audioMutedRef.current;
    audio.onerror = (): void => { setAudioReady(false); };
    audioRef.current = audio;

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        if (audioRef.current !== audio) return; // superseded
        setAudioReady(true);
        const t0 = performance.now();
        const doFadeIn = (now: number): void => {
          if (audioRef.current !== audio) return;
          const p = Math.min((now - t0) / FADE_MS, 1);
          audio.volume = TARGET_VOL * p;
          if (p < 1) { fadeInRafId.current = requestAnimationFrame(doFadeIn); }
        };
        fadeInRafId.current = requestAnimationFrame(doFadeIn);
      }).catch(() => { setAudioReady(false); });
    }

    return () => {
      cancelAnimationFrame(fadeOutRafId.current);
      cancelAnimationFrame(fadeInRafId.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioEnabled, activeSpace?.ambientAudio]);

  // Cleanup audio + cinematic on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(fadeOutRafId.current);
      cancelAnimationFrame(fadeInRafId.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
    };
  }, []);

  // Cinematic auto-advance — fires after CINEMATIC_MS if playing
  useEffect(() => {
    if (!isCinematic || cinematicPaused || showCinematicEnd || prefersReducedMotion) {
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
      return;
    }
    if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
    cinematicTimerRef.current = setTimeout(() => {
      const curIdx = sortedSpaces.findIndex((s) => s.id === activeSpaceId);
      const isLast = curIdx < 0 || curIdx >= sortedSpaces.length - 1;
      if (isLast) {
        setShowCinematicEnd(true);
      } else {
        const nextSpace = sortedSpaces[curIdx + 1]!;
        runTransition(() => { handleSpaceChange(nextSpace.id); }, nextSpace.id);
      }
    }, CINEMATIC_MS);
    return () => {
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCinematic, cinematicPaused, activeSpaceId, showCinematicEnd, prefersReducedMotion]);

  // Cinematic progress bar — reset tick on each space so CSS transition fires fresh
  useEffect(() => {
    if (!isCinematic || cinematicPaused || showCinematicEnd || prefersReducedMotion) {
      setCpTick(false);
      return;
    }
    setCpTick(false);
    const t = setTimeout(() => { setCpTick(true); }, 32); // 2 frames — lets the bar reset to 0 first
    return () => { clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCinematic, cinematicPaused, activeSpaceId, showCinematicEnd, prefersReducedMotion]);

  // Prewarm prev/next and hotspot-target panorama assets so transitions feel instant
  useEffect(() => {
    if (!activeSpace) return;
    const currentIdx = sortedSpaces.findIndex((s) => s.id === activeSpace.id);
    const prewarmIds: string[] = [];
    if (currentIdx > 0) prewarmIds.push(sortedSpaces[currentIdx - 1]!.id);
    if (currentIdx < sortedSpaces.length - 1) prewarmIds.push(sortedSpaces[currentIdx + 1]!.id);
    for (const hs of activeAsset?.hotspots ?? []) {
      if (hs.targetSpaceId && !prewarmIds.includes(hs.targetSpaceId)) {
        prewarmIds.push(hs.targetSpaceId);
      }
    }
    const imgs: HTMLImageElement[] = [];
    for (const sid of prewarmIds) {
      const space = sortedSpaces.find((s) => s.id === sid);
      const asset = selectPrimaryAsset(space);
      if (asset?.url && asset.type === 'panorama_360') {
        const img = new Image();
        img.src = asset.url;
        imgs.push(img);
      }
    }
    return () => { imgs.forEach((img) => { img.src = ''; }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpace?.id]);

  function toggleFullscreen(): void {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (viewerRef.current) {
      viewerRef.current.requestFullscreen().catch(() => {});
    }
  }

  // ── Guided tour functions ────────────────────────────────────────────────────

  function startGuidedTour(): void {
    const firstSpace = sortedSpaces[0];
    if (!firstSpace || sortedSpaces.length < 2) return;

    setIsGuidedTour(true);
    setGuidedTourIdx(0);
    setIsMeasuring(false);
    setShowDollhouse(false);

    if (activeSpaceId !== firstSpace.id) {
      runTransition(() => {
        setActiveSpaceId(firstSpace.id);
        setActiveHotspot(null);
      }, firstSpace.id);
    } else {
      setActiveHotspot(null);
    }

    const payload = {
      step: 1,
      totalSteps: sortedSpaces.length,
      spaceId: firstSpace.id,
      spaceName: firstSpace.name
    };
    onAnalyticsEvent(createViewerEvent('tour_start', { spaceId: firstSpace.id, data: payload }));
    trackToBackend({
      propertyId,
      spaceId: firstSpace.id,
      type: 'tour_start',
      label: firstSpace.name,
      payload,
      sessionId: sessionId.current
    });
  }

  function exitGuidedTour(): void {
    setIsGuidedTour(false);
    setGuidedTourIdx(0);
  }

  function startCinematicTour(): void {
    if (prefersReducedMotion) return;
    setIsCinematic(true);
    setCinematicPaused(false);
    setShowCinematicEnd(false);
    setIsMeasuring(false);
    setShowDollhouse(false);
    setActiveHotspot(null);
    // Go to first space so tour is consistent
    const firstSpace = sortedSpaces[0];
    if (firstSpace && activeSpaceId !== firstSpace.id) {
      runTransition(() => {
        setActiveSpaceId(firstSpace.id);
        setActiveHotspot(null);
      }, firstSpace.id);
    }
    trackToBackend({
      propertyId,
      spaceId: activeSpaceId,
      type: 'tour_start',
      label: 'cinematic',
      sessionId: sessionId.current
    });
  }

  function stopCinematicTour(): void {
    setIsCinematic(false);
    setCinematicPaused(false);
    setShowCinematicEnd(false);
    if (cinematicTimerRef.current) {
      clearTimeout(cinematicTimerRef.current);
      cinematicTimerRef.current = null;
    }
  }

  function stepGuidedTour(dir: 1 | -1): void {
    const newIdx = guidedTourIdx + dir;
    if (newIdx < 0 || newIdx >= sortedSpaces.length) return;
    const nextSpace = sortedSpaces[newIdx];
    if (!nextSpace) return;

    const isLast     = newIdx === sortedSpaces.length - 1;
    const eventType: ViewerEvent['type'] = isLast ? 'tour_complete' : 'tour_step';
    const payload = {
      step: newIdx + 1,
      totalSteps: sortedSpaces.length,
      spaceId: nextSpace.id,
      spaceName: nextSpace.name
    };
    onAnalyticsEvent(createViewerEvent(eventType, { spaceId: nextSpace.id, data: payload }));
    trackToBackend({
      propertyId,
      spaceId: nextSpace.id,
      type: eventType,
      label: nextSpace.name,
      payload,
      sessionId: sessionId.current
    });

    runTransition(() => {
      setGuidedTourIdx(newIdx);
      setActiveSpaceId(nextSpace.id);
      setActiveHotspot(null);
    }, nextSpace.id);
  }

  // ── Cinematic transition runner ──────────────────────────────────────────────

  function runTransition(swapFn: () => void, targetId: string): void {
    if (transitionLock.current) {
      pendingSpaceRef.current = targetId;  // last click wins
      pendingSwapRef.current  = swapFn;
      return;
    }
    transitionLock.current = true;
    const ms = prefersReducedMotion ? 80 : isTouchDevice.current ? 120 : 160;
    setTPhase('out');
    setTimeout(() => {
      swapFn();
      setTPhase('in');
      setTimeout(() => {
        setTPhase('idle');
        transitionLock.current = false;
        const pendingId = pendingSpaceRef.current;
        const pendingFn = pendingSwapRef.current;
        pendingSpaceRef.current = null;
        pendingSwapRef.current  = null;
        if (pendingId && pendingFn) {
          runTransition(pendingFn, pendingId);
        }
      }, ms);
    }, ms);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function handleSpaceChange(spaceId: string): void {
    const nextSpace = sortedSpaces.find((space) => space.id === spaceId);
    if (!nextSpace) return;

    // Sync guided tour index when the user navigates manually
    if (isGuidedTour) {
      const newIdx = sortedSpaces.findIndex((s) => s.id === spaceId);
      if (newIdx >= 0) {
        setGuidedTourIdx(newIdx);
      } else {
        setIsGuidedTour(false);
        setGuidedTourIdx(0);
      }
    }

    setIsMeasuring(false);
    setShowDollhouse(false);
    setActiveSpaceId(spaceId);
    setActiveHotspot(null);

    const event = createViewerEvent('space_change', {
      spaceId,
      data: { propertyId, spaceName: nextSpace.name }
    });
    onAnalyticsEvent(event);
    trackToBackend({
      propertyId,
      spaceId,
      type: 'space_change',
      label: nextSpace.name,
      sessionId: sessionId.current
    });
  }

  function handleHotspotClick(hotspot: Hotspot): void {
    const event = createViewerEvent('hotspot_click', {
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      hotspotId: hotspot.id,
      data: { propertyId, hotspotLabel: hotspot.label, hotspotType: hotspot.type, targetSpaceId: hotspot.targetSpaceId }
    });
    onAnalyticsEvent(event);
    trackToBackend({
      propertyId,
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      type: 'hotspot_click',
      label: hotspot.label,
      payload: hotspot.targetSpaceId
        ? JSON.stringify({ hotspotType: hotspot.type, targetSpaceId: hotspot.targetSpaceId })
        : undefined,
      sessionId: sessionId.current
    });

    // Navigation hotspots: switch space directly — do not open info panel
    if (hotspot.type === 'navigation' && hotspot.targetSpaceId) {
      runTransition(() => { handleSpaceChange(hotspot.targetSpaceId!); }, hotspot.targetSpaceId);
      return;
    }

    setActiveHotspot(hotspot);
  }

  function handleLeadCtaOpen(): void {
    setShowLeadModal(true);
  }

  function handleLeadSubmitted(): void {
    const event = createViewerEvent('cta_lead', {
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      hotspotId: activeHotspot?.id,
      data: { propertyId, hotspotLabel: activeHotspot?.label ?? 'Tour guiado' }
    });
    onAnalyticsEvent(event);
    trackToBackend({
      propertyId,
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      type: 'lead_cta',
      label: activeHotspot?.label ?? 'Tour guiado',
      sessionId: sessionId.current
    });
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!activeSpace || !activeAsset) {
    return (
      <section className={`rounded-[1.6rem] bg-slate-950 p-6 text-white ${className}`}>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">
          Experiencia inmersiva
        </p>
        <h2 className="mt-3 text-3xl font-black">Sin estancias configuradas</h2>
        <p className="mt-3 text-white/60">
          Esta propiedad necesita al menos una estancia y un asset para activar el visor.
        </p>
      </section>
    );
  }

  // ── Derived values for tour panel ────────────────────────────────────────────
  const tourDimensions  = formatSpaceDimensions(activeSpace.dimensions);
  const tourDescription = isGuidedTour ? getSpaceDescription(activeSpace) : null;
  const isLastTourStep  = guidedTourIdx === sortedSpaces.length - 1;
  const tourProgress    = sortedSpaces.length > 0
    ? ((guidedTourIdx + 1) / sortedSpaces.length) * 100
    : 0;
  const leadModalLabel  = activeHotspot?.label ?? 'Tour guiado';

  // ── Nav overlay prev/next (always visible with 2+ spaces) ───────────────────
  const currentSpaceIdx = sortedSpaces.findIndex((s) => s.id === activeSpace.id);
  const prevSpace = currentSpaceIdx > 0 ? sortedSpaces[currentSpaceIdx - 1] : null;
  const nextSpace = currentSpaceIdx < sortedSpaces.length - 1 ? sortedSpaces[currentSpaceIdx + 1] : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section
      ref={viewerRef}
      className={`relative overflow-hidden rounded-[1.6rem] bg-slate-950 text-white ${className} ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''}`}
      onPointerDown={() => {
        if (!audioEnabled) setAudioEnabled(true);
        if (storyVisible) {
          if (storyTimerRef.current) clearTimeout(storyTimerRef.current);
          setStoryVisible(false);
        }
      }}
    >
      {/* ── Branded loading screen (seconds 0–2) ──────────────────────────── */}
      {showBrandedLoading ? (
        <div
          className="pointer-events-none absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950 px-6"
          style={{
            opacity: loadingVisible ? 1 : 0,
            transition: 'opacity 500ms ease-in-out'
          }}
        >
          {/* Accent line — parallax layer A */}
          <div
            className="mb-10 h-px w-10 rounded-full"
            style={{
              backgroundColor: primaryColor,
              transform: 'translate(calc(var(--px, 0px) * 1.2), calc(var(--py, 0px) * 0.8))',
              transition: 'transform 80ms linear',
            }}
          />

          {/* Property title — parallax layer B (lighter) */}
          <h2
            className="max-w-xs text-center text-2xl font-black leading-snug tracking-tight text-white"
            style={{
              transform: 'translate(calc(var(--px, 0px) * 0.5), calc(var(--py, 0px) * 0.35))',
              transition: 'transform 80ms linear',
            }}
          >
            {propertyTitle ?? sortedSpaces[0]?.name ?? 'Experiencia inmersiva'}
          </h2>

          {/* Agency name / subtitle */}
          <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-white/35">
            {agencyName ?? 'Experiencia inmersiva'}
          </p>

          {/* Progress line — parallax layer C */}
          <div
            className="mt-12 h-px w-28 overflow-hidden rounded-full bg-white/10"
            style={{
              transform: 'translate(calc(var(--px, 0px) * 0.7), calc(var(--py, 0px) * 0.5))',
              transition: 'transform 80ms linear',
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: primaryColor,
                width: progressStarted ? '100%' : '0%',
                transition: 'width 1660ms ease-in-out'
              }}
            />
          </div>
        </div>
      ) : null}

      {showLeadModal ? (
        <LeadCaptureModal
          propertyId={propertyId}
          hotspotLabel={leadModalLabel}
          primaryColor={primaryColor}
          onClose={() => setShowLeadModal(false)}
          onSubmitted={() => { handleLeadSubmitted(); }}
        />
      ) : null}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {/* Tour counter always visible — it's UX, not branding */}
          {isCinematic ? (
            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">
              {cinematicPaused ? 'Cinematic · En pausa' : '● Cinematic'} · {currentSpaceIdx + 1} / {sortedSpaces.length}
            </p>
          ) : isGuidedTour ? (
            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">
              Tour guiado · {guidedTourIdx + 1} / {sortedSpaces.length}
            </p>
          ) : !removeBranding ? (
            <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">
              Recorrido inmersivo
            </p>
          ) : null}
          <h2 className="mt-2 text-3xl font-black">{activeSpace.name}</h2>
          {!removeBranding ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              {activeAsset.type === 'panorama_360'
                ? 'Panorama 360°'
                : activeAsset.type === 'gaussian_splat'
                  ? 'Vista inmersiva'
                  : 'Modelo 3D'}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Space selector pills */}
          {sortedSpaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => { runTransition(() => handleSpaceChange(space.id), space.id); }}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                activeSpace.id === space.id
                  ? 'text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
              style={activeSpace.id === space.id ? { backgroundColor: primaryColor } : undefined}
            >
              {space.order}. {space.name}
            </button>
          ))}

          {/* Guided tour / Cinematic — only visible with 2+ spaces */}
          {sortedSpaces.length >= 2 ? (
            isCinematic ? (
              <>
                <button
                  type="button"
                  onClick={() => { setCinematicPaused((p) => !p); }}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${
                    cinematicPaused
                      ? 'bg-white/10 text-white/60 hover:bg-white/15'
                      : 'bg-violet-600/70 text-white hover:bg-violet-600'
                  }`}
                  title={cinematicPaused ? 'Reanudar recorrido' : 'Pausar recorrido'}
                >
                  {cinematicPaused ? '▶ Reanudar' : '⏸ Pausa'}
                </button>
                <button
                  type="button"
                  onClick={stopCinematicTour}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/40 transition hover:bg-white/15 hover:text-white/70"
                >
                  ✕ Salir
                </button>
              </>
            ) : isGuidedTour ? (
              <button
                type="button"
                onClick={exitGuidedTour}
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"
              >
                ✕ Salir del tour
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startGuidedTour}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
                >
                  ▶ Tour
                </button>
                {!prefersReducedMotion ? (
                  <button
                    type="button"
                    onClick={startCinematicTour}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
                    title="Recorrido automatico cinematografico"
                  >
                    Cinematic
                  </button>
                ) : null}
              </>
            )
          ) : null}

          {/* Plano / Dollhouse — visible to visitors (it's a premium feature) */}
          <button
            type="button"
            onClick={() => {
              setIsMeasuring(false);
              setShowDollhouse((prev) => !prev);
            }}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${
              showDollhouse
                ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
                : 'bg-white/10 text-white/70 hover:bg-white/15'
            }`}
          >
            {showDollhouse ? '← Recorrido' : floorplanUrl ? '🗺 Plano' : '🏠 Planta'}
          </button>

          {/* Fullscreen — useful for demos, clean single button */}
          {document.fullscreenEnabled ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
            >
              {isFullscreen ? '⊠' : '⛶'}
            </button>
          ) : null}

          {/* ··· Advanced tools — not for visitors, not for the demo pitch */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowTools((v) => !v); }}
              title="Herramientas"
              className={`rounded-full px-3 py-2 text-sm font-black transition ${
                showTools
                  ? 'bg-white/20 text-white'
                  : 'bg-white/10 text-white/40 hover:bg-white/15 hover:text-white/70'
              }`}
            >
              {'···'}
            </button>
            {showTools ? (
              <div className="absolute right-0 top-full z-50 mt-2 flex min-w-[160px] flex-col gap-1 rounded-2xl border border-white/10 bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsMeasuring((prev) => !prev);
                    setShowDollhouse(false);
                    setShowTools(false);
                  }}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
                    isMeasuring
                      ? 'bg-emerald-400/20 text-emerald-300'
                      : 'text-white/60 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <span>📏</span>
                  <span>{isMeasuring ? 'Midiendo' : 'Medir espacio'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setStoryMode((m) => !m); setShowTools(false); }}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
                    storyMode
                      ? 'text-violet-300 hover:bg-violet-600/20'
                      : 'text-white/40 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  <span>✦</span>
                  <span>{storyMode ? 'Narrativa activa' : 'Narrativa desact.'}</span>
                </button>
                {audioReady ? (
                  <button
                    type="button"
                    onClick={() => { setAudioMuted((m) => !m); setShowTools(false); }}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
                      audioMuted
                        ? 'text-white/40 hover:bg-white/10 hover:text-white/60'
                        : 'text-violet-300 hover:bg-violet-600/20'
                    }`}
                  >
                    <span>{audioMuted ? '🔇' : '🔊'}</span>
                    <span>{audioMuted ? 'Silenciado' : 'Ambiente activo'}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">

        {/* Viewer area */}
        <div
          className="relative p-5"
          onPointerDown={() => {
            // Pause cinematic on any direct viewer interaction (drag, tap on panorama)
            if (isCinematic && !cinematicPaused) setCinematicPaused(true);
          }}
        >
          {/* Cinematic transition overlay — fades to black between spaces, stays visible until idle */}
          <div
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-[1.5rem] bg-slate-950"
            style={{
              opacity: tPhase !== 'idle' ? 1 : 0,
              transition: `opacity ${prefersReducedMotion ? 80 : isTouchDevice.current ? 120 : 160}ms ease-in-out`,
            }}
          >
            {!prefersReducedMotion && tPhase === 'in' ? (
              <p
                className="text-[11px] font-bold uppercase tracking-widest text-white/30"
                style={{ transform: 'translate(calc(var(--px, 0px) * 0.6), calc(var(--py, 0px) * 0.4))', transition: 'transform 80ms linear' }}
              >
                Preparando estancia...
              </p>
            ) : null}
          </div>
          {/* Micro-scale wrapper — subtle parallax on desktop only, not on mobile/reduced-motion */}
          <div
            style={!prefersReducedMotion && !isTouchDevice.current ? {
              transform: tPhase === 'out' ? 'scale(1.012)' : 'scale(1)',
              transition: 'transform 160ms ease-out',
            } : undefined}
          >
          <ViewerErrorBoundary key={`eb-${activeSpace.id}`}>
            {showDollhouse && floorplanUrl ? (
              <FloorplanViewer
                floorplanUrl={floorplanUrl}
                spaces={sortedSpaces}
                activeSpaceId={activeSpace.id}
                primaryColor={primaryColor}
                onSpaceClick={(spaceId) => { runTransition(() => { handleSpaceChange(spaceId); setShowDollhouse(false); }, spaceId); }}
              />
            ) : showDollhouse ? (
              <DollhouseViewer
                spaces={sortedSpaces}
                primaryColor={primaryColor}
                activeSpaceId={activeSpace.id}
                onSpaceClick={(spaceId) => { runTransition(() => handleSpaceChange(spaceId), spaceId); }}
              />
            ) : activeAsset.type === 'panorama_360' ? (
              <PanoramaViewer
                key={`pano-${activeSpace.id}-${activeAsset.id}`}
                propertyId={propertyId}
                spaceId={activeSpace.id}
                asset={activeAsset}
                primaryColor={primaryColor}
                measureMode={isMeasuring}
                spacePreviewMap={spacePreviewMap}
                onHotspotClick={handleHotspotClick}
                onAnalyticsEvent={onAnalyticsEvent}
              />
            ) : activeAsset.type === 'gaussian_splat' ? (
              <GaussianSplatViewer
                key={`splat-${activeSpace.id}-${activeAsset.id}`}
                propertyId={propertyId}
                spaceId={activeSpace.id}
                asset={activeAsset}
                primaryColor={primaryColor}
                measureMode={isMeasuring}
                isAdminMode={false}
                onAnalyticsEvent={onAnalyticsEvent}
              />
            ) : (
              <Suspense
                key={`glb-${activeSpace.id}-${activeAsset.id}`}
                fallback={
                  <div className="flex min-h-[520px] items-center justify-center rounded-[1.5rem] bg-slate-800">
                    <p className="text-sm font-bold text-slate-400">Cargando modelo 3D...</p>
                  </div>
                }
              >
                <GlbViewer
                  src={activeAsset.url}
                  alt={activeSpace.name}
                  autoRotate
                  cameraControls
                  ar={false}
                  className="min-h-[520px]"
                />
              </Suspense>
            )}
          </ViewerErrorBoundary>
          </div>{/* end micro-scale wrapper */}

          {/* ── Cinematic progress line — top edge, very subtle ───────────── */}
          {isCinematic && !showCinematicEnd ? (
            <div className="pointer-events-none absolute inset-x-5 top-5 z-20 h-[2px] overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: primaryColor,
                  opacity: 0.22,
                  width: cpTick ? '100%' : '0%',
                  transition: (cpTick && !cinematicPaused)
                    ? `width ${CINEMATIC_MS}ms linear`
                    : 'none',
                }}
              />
            </div>
          ) : null}

          {/* ── Cinematic end screen — CTA final ──────────────────────────── */}
          {showCinematicEnd ? (
            <div className="pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 rounded-[1.5rem] bg-slate-950/92 px-8 text-center backdrop-blur-sm">
              <div className="h-px w-8 rounded-full" style={{ backgroundColor: primaryColor }} />
              <h3 className="max-w-[260px] text-2xl font-black leading-snug text-white">
                {propertyTitle ?? activeSpace.name}
              </h3>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-white/30">
                Recorrido completo
              </p>
              <button
                type="button"
                onClick={handleLeadCtaOpen}
                className="mt-2 rounded-2xl px-6 py-4 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Solicitar visita
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstSpace = sortedSpaces[0];
                  if (firstSpace) {
                    setShowCinematicEnd(false);
                    setCinematicPaused(false);
                    runTransition(() => {
                      setActiveSpaceId(firstSpace.id);
                      setActiveHotspot(null);
                    }, firstSpace.id);
                  }
                }}
                className="text-sm font-bold text-white/40 transition hover:text-white/70"
              >
                Explorar de nuevo
              </button>
              <button
                type="button"
                onClick={stopCinematicTour}
                className="text-xs font-bold text-white/20 transition hover:text-white/45"
              >
                Salir del recorrido
              </button>
            </div>
          ) : null}

          {/* ── Storytelling overlay — editorial, pointer-events-none ─────── */}
          {storyMode && (activeSpace.storySubheadline || activeSpace.storyHighlight) ? (
            <div
              className="pointer-events-none absolute bottom-0 left-0 z-30 px-7 pb-8"
              style={{
                opacity: storyVisible ? 1 : 0,
                transition: prefersReducedMotion
                  ? 'none'
                  : storyVisible
                    ? 'opacity 400ms ease-in'
                    : 'opacity 600ms ease-out',
              }}
            >
              <div className="flex items-start gap-3">
                {/* vertical accent line */}
                <div className="mt-1 h-8 w-px shrink-0 rounded-full bg-white/35" />
                <div>
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.32em] text-white/35">
                    {activeSpace.name}
                  </p>
                  {activeSpace.storySubheadline ? (
                    <h3 className="mt-1.5 max-w-[300px] text-2xl font-black leading-snug text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.7)]">
                      {activeSpace.storySubheadline}
                    </h3>
                  ) : null}
                  {activeSpace.storyHighlight ? (
                    <p className="mt-2 max-w-[260px] text-sm font-light italic leading-snug text-white/60">
                      {activeSpace.storyHighlight}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Prev / Next overlay navigation ─────────────────────────────── */}
          {sortedSpaces.length >= 2 && !showDollhouse ? (
            <div
              className="pointer-events-none absolute inset-x-5 flex items-end justify-between gap-3"
              style={{ bottom: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))' }}
            >
              {prevSpace ? (
                <button
                  type="button"
                  onClick={() => { runTransition(() => handleSpaceChange(prevSpace.id), prevSpace.id); }}
                  className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-950/70 px-4 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-slate-950/90 active:scale-95"
                >
                  <span className="text-lg leading-none">←</span>
                  <span className="max-w-[120px] truncate">{prevSpace.name}</span>
                </button>
              ) : (
                <div />
              )}
              {nextSpace ? (
                <button
                  type="button"
                  onClick={() => { runTransition(() => handleSpaceChange(nextSpace.id), nextSpace.id); }}
                  className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-950/70 px-4 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-slate-950/90 active:scale-95"
                  style={{ borderLeft: `3px solid ${primaryColor}` }}
                >
                  <span className="max-w-[120px] truncate">{nextSpace.name}</span>
                  <span className="text-lg leading-none">→</span>
                </button>
              ) : (
                <div />
              )}
            </div>
          ) : null}
        </div>

        {/* ── Aside panel ──────────────────────────────────────────────────── */}
        <aside className="border-t border-white/10 bg-white/[0.04] p-5 lg:border-l lg:border-t-0">

          {/* CINEMATIC PANEL — shown when cinematic tour active and no hotspot open */}
          {isCinematic && !activeHotspot ? (
            <>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  {cinematicPaused ? 'Cinematic · En pausa' : '● Cinematic'}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-white/50">
                  <span>Estancia {currentSpaceIdx + 1} de {sortedSpaces.length}</span>
                  {cinematicPaused ? (
                    <span className="text-amber-400/60">Pausado</span>
                  ) : (
                    <span className="text-violet-300/50">Auto</span>
                  )}
                </div>
                <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: primaryColor,
                      opacity: 0.22,
                      width: cpTick ? '100%' : '0%',
                      transition: (cpTick && !cinematicPaused)
                        ? `width ${CINEMATIC_MS}ms linear`
                        : 'none',
                    }}
                  />
                </div>
                <h3 className="mt-4 text-2xl font-black">{activeSpace.name}</h3>
                {activeSpace.storySubheadline ? (
                  <p className="mt-2 text-sm font-light italic leading-snug text-white/45">
                    {activeSpace.storySubheadline}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCinematicPaused((p) => !p); }}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    cinematicPaused
                      ? 'bg-violet-600/70 text-white hover:bg-violet-600'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {cinematicPaused ? '▶ Reanudar' : '⏸ Pausar'}
                </button>
              </div>

              <button
                type="button"
                onClick={stopCinematicTour}
                className="mt-3 w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-bold text-white/40 transition hover:bg-white/10 hover:text-white/60"
              >
                {'✕'} Salir del recorrido
              </button>
            </>
          ) : /* GUIDED TOUR PANEL — shown when tour active and no hotspot is open */
          isGuidedTour && !activeHotspot ? (
            <>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  Tour guiado
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-white/50">
                  <span>Estancia {guidedTourIdx + 1} de {sortedSpaces.length}</span>
                  <span>{Math.round(tourProgress)}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-all duration-500"
                    style={{ width: `${tourProgress}%` }}
                  />
                </div>
                <h3 className="mt-4 text-2xl font-black">{activeSpace.name}</h3>
                {tourDimensions ? (
                  <p className="mt-2 text-xs font-bold text-white/40">{tourDimensions}</p>
                ) : null}
                {tourDescription ? (
                  <p className="mt-3 text-sm leading-6 text-white/65">{tourDescription}</p>
                ) : null}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={guidedTourIdx === 0}
                  onClick={() => { stepGuidedTour(-1); }}
                  className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← Anterior
                </button>
                {isLastTourStep ? (
                  <button
                    type="button"
                    onClick={handleLeadCtaOpen}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Solicitar información
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { stepGuidedTour(1); }}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Siguiente →
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={exitGuidedTour}
                className="mt-3 w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-bold text-white/40 transition hover:bg-white/10 hover:text-white/60"
              >
                ✕ Salir del tour
              </button>
            </>
          ) : (
            /* DEFAULT / HOTSPOT PANEL */
            <>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  Estancia activa
                </p>
                <h3 className="mt-3 text-2xl font-black">{activeSpace.name}</h3>
                <p className="mt-2 text-sm text-white/55">
                  {activeAsset.type === 'panorama_360'
                    ? 'Panorama 360°'
                    : activeAsset.type === 'gaussian_splat'
                      ? 'Vista inmersiva'
                      : 'Modelo 3D'}
                  {activeSpace.dimensions?.width != null && activeSpace.dimensions?.depth != null
                    ? ` · ${activeSpace.dimensions.width} × ${activeSpace.dimensions.depth} m`
                    : ''}
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  Información
                </p>

                {activeHotspot ? (
                  <div className="mt-4">
                    <h3 className="text-2xl font-black">{activeHotspot.label}</h3>
                    {activeHotspot.body ? (
                      <p className="mt-3 text-sm leading-6 text-white/65">{activeHotspot.body}</p>
                    ) : null}
                    {activeHotspot.metric ? (
                      <div className="mt-4 rounded-2xl bg-black/25 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                          Dato
                        </p>
                        <p className="mt-1 text-xl font-black">{activeHotspot.metric}</p>
                      </div>
                    ) : null}
                    {activeHotspot.type === 'cta' ? (
                      <button
                        type="button"
                        onClick={handleLeadCtaOpen}
                        className="mt-4 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Solicitar información
                      </button>
                    ) : null}
                    {/* Return to tour if guided tour is still active */}
                    {isGuidedTour ? (
                      <button
                        type="button"
                        onClick={() => setActiveHotspot(null)}
                        className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-2 text-xs font-black text-white/60 transition hover:bg-white/15"
                      >
                        ← Volver al tour
                      </button>
                    ) : null}
                  </div>
                ) : activeSpace.storySubheadline || activeSpace.storyHighlight ? (
                  /* Emotional default — show the space narrative, not a tutorial */
                  <div className="mt-4">
                    {activeSpace.storySubheadline ? (
                      <h4 className="text-xl font-black leading-snug text-white">
                        {activeSpace.storySubheadline}
                      </h4>
                    ) : null}
                    {activeSpace.storyHighlight ? (
                      <p className="mt-2 text-sm font-light italic leading-relaxed text-white/55">
                        {activeSpace.storyHighlight}
                      </p>
                    ) : null}
                    {(activeAsset?.hotspots?.length ?? 0) > 0 ? (
                      <p className="mt-5 text-xs text-white/25">
                        Selecciona un punto del espacio para ver detalles
                      </p>
                    ) : null}
                  </div>
                ) : (
                  /* Minimal fallback — no story content configured */
                  <p className="mt-4 text-xs leading-6 text-white/30">
                    {(activeAsset?.hotspots?.length ?? 0) > 0
                      ? 'Selecciona un punto del espacio para ver detalles'
                      : 'Explora la estancia con el visor 360°'}
                  </p>
                )}
              </div>

              {/* ── Contextual CTA — luxury action, integrated ─────────────── */}
              {activeSpace.ctaLabel ? (
                <div className="mt-5 border-t border-white/[0.06] pt-5">
                  <p className="mb-3 text-[0.58rem] font-bold uppercase tracking-[0.3em] text-white/30">
                    Próximo paso
                  </p>
                  <button
                    type="button"
                    onClick={handleLeadCtaOpen}
                    className="group flex w-full items-center justify-between rounded-2xl bg-white/[0.06] px-5 py-4 text-left transition hover:bg-white/[0.1]"
                    style={{ borderLeft: `2px solid ${primaryColor}` }}
                  >
                    <div>
                      <p className="text-sm font-black text-white">{activeSpace.ctaLabel}</p>
                      {activeSpace.ctaSubtext ? (
                        <p className="mt-0.5 text-xs text-white/40">{activeSpace.ctaSubtext}</p>
                      ) : null}
                    </div>
                    <span className="text-white/30 transition group-hover:text-white/60">
                      →
                    </span>
                  </button>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      {/* ── Mobile hotspot bottom sheet ──────────────────────────────────────── */}
      {mobileSheetOpen && activeHotspot ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => { setActiveHotspot(null); }}
        >
          {/* scrim */}
          <div className="absolute inset-0 bg-black/50" />
          {/* sheet */}
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-[1.6rem] bg-slate-900 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] text-white shadow-2xl"
            style={{ maxHeight: '70dvh', overflowY: 'auto' }}
            onClick={(e) => { e.stopPropagation(); }}
          >
            {/* drag handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  Punto destacado
                </p>
                <h3 className="mt-1 text-xl font-black leading-snug">{activeHotspot.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => { setActiveHotspot(null); }}
                className="shrink-0 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            {activeHotspot.body ? (
              <p className="mt-4 text-sm leading-6 text-white/65">{activeHotspot.body}</p>
            ) : null}
            {activeHotspot.metric ? (
              <div className="mt-4 rounded-2xl bg-black/30 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Dato</p>
                <p className="mt-1 text-xl font-black">{activeHotspot.metric}</p>
              </div>
            ) : null}
            {activeHotspot.type === 'cta' ? (
              <button
                type="button"
                onClick={() => { setActiveHotspot(null); handleLeadCtaOpen(); }}
                className="mt-5 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Solicitar información
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
