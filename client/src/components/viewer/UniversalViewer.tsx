import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ArrowLeft, Info, X } from 'lucide-react';
import DollhouseViewer from '@/components/viewer/DollhouseViewer';
import FloorplanViewer from '@/components/viewer/FloorplanViewer';
const GaussianSplatViewer = lazy(() => import('@/components/viewer/GaussianSplatViewer'));
import LeadCaptureModal from '@/components/viewer/LeadCaptureModal';
import MinimapOverlay from '@/components/viewer/MinimapOverlay';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';
import { t } from '@/i18n/dictionary';

const GlbViewer = lazy(() => import('@/components/viewer/GlbViewer'));
const LumaEmbedViewer = lazy(() => import('@/components/viewer/LumaEmbedViewer'));
const SuperSplatEmbedViewer = lazy(() => import('@/components/viewer/SuperSplatEmbedViewer'));
import { AUTH_STORAGE_KEYS } from '@/services/api';
import type {
  Hotspot,
  HotspotPosition,
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

// ── sessionId — persists for the browser tab lifetime via sessionStorage ─────

function getOrCreateSessionId(): string {
  const KEY = 'immersphere_session_id';
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// ── Client-side dedupe — prevents accidental rapid re-fires ──────────────────

/** Events exempt from deduplication (every occurrence is meaningful). */
const NO_DEDUPE = new Set(['lead_submitted', 'guided_tour_completed']);
const DEDUPE_WINDOW_MS = 5000;
const _dedupeCache = new Map<string, number>();

function isDupe(type: string, propertyId: string, spaceId?: unknown, hotspotId?: unknown): boolean {
  if (NO_DEDUPE.has(type)) return false;
  const key = [type, propertyId, String(spaceId ?? ''), String(hotspotId ?? '')].join('::');
  const now = Date.now();
  const last = _dedupeCache.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;
  _dedupeCache.set(key, now);
  return false;
}

// ── Fire-and-forget analytics POST ───────────────────────────────────────────

function trackToBackend(payload: Record<string, unknown>): void {
  const { type, propertyId, spaceId, hotspotId } = payload as {
    type?: string; propertyId?: string; spaceId?: string; hotspotId?: string;
  };
  if (type && propertyId && isDupe(type, propertyId, spaceId, hotspotId)) return;

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
function formatSpaceDimensions(dims: Space['dimensions'], lang?: string): string | null {
  if (!dims) return null;
  const parts: string[] = [];
  if (dims.width != null)  parts.push(`${t(lang, 'dim_width')} ${dims.width} m`);
  if (dims.height != null) parts.push(`${t(lang, 'dim_height')} ${dims.height} m`);
  if (dims.depth != null)  parts.push(`${t(lang, 'dim_depth')} ${dims.depth} m`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ── Error boundary ──────────────────────────────────────────────────────────

interface EBState { hasError: boolean; error: Error | null }
interface EBProps  { children: ReactNode; lang?: string }

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
      const lang = this.props.lang;
      return (
        <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-[1.5rem] bg-slate-800 p-6 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="text-sm font-black text-white">{t(lang, 'viewer_error')}</p>
          <p className="text-xs text-white/50">{t(lang, 'viewer_error_body')}</p>
          <button
            type="button"
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white/70 transition hover:bg-white/20"
          >
            {t(lang, 'retry')}
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
  language,
  propertyTitle,
  agencyName,
  agencyLogoUrl,
  tenantWhatsapp = '',
  tenantCalendlyUrl = '',
  floorplanUrl,
  guidedConfig,
  arEnabled = false,
  onAnalyticsEvent,
  disableLeadCapture = false,
  desktopImmersive = false,
  onBack
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
  const [leadContext, setLeadContext] = useState<Record<string, string | undefined> | undefined>();
  const [mediaModal, setMediaModal] = useState<{
    type: 'image' | 'video';
    url: string;
    title: string;
    description?: string;
  } | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  /** Spatial breadcrumb trail — records each space visited in order, capped at 12 */
  const [visitHistory, setVisitHistory] = useState<string[]>(
    () => [(initialSpaceId ?? firstSpaceId)].filter(Boolean)
  );

  // ── Guided tour ─────────────────────────────────────────────────────────────
  const [isGuidedTour, setIsGuidedTour]     = useState(false);
  const [guidedTourIdx, setGuidedTourIdx]   = useState(0);

  // ── Other viewer modes ───────────────────────────────────────────────────────
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [isMeasuring,   setIsMeasuring]   = useState(false);
  const [showDollhouse, setShowDollhouse] = useState(false);
  const [showTools,     setShowTools]     = useState(false); // advanced tools menu (···)
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

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
  const transitionLock       = useRef(false);
  const pendingSpaceRef      = useRef<string | null>(null);
  const pendingSwapRef       = useRef<(() => void) | null>(null);
  const isTouchDevice        = useRef(window.matchMedia('(pointer: coarse)').matches);
  /** Set before calling runTransition to control cinematic zoom intensity */
  const transitionIntentRef  = useRef<'hotspot' | 'nav' | ''>('');
  /**
   * Directional drift vector for cinematic transitions.
   * Computed from hotspot.position (yaw/pitch for panoramas, x/y otherwise).
   * Applies translateX/translateY during the 'out' phase only.
   * Cleared when transition returns to 'idle'.
   */
  const driftRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const viewerRef       = useRef<HTMLElement>(null);
  const sessionId       = useRef(getOrCreateSessionId());
  const spaceEnteredAt  = useRef<number>(Date.now());
  const activeSpaceIdRef = useRef<string>(initialSpaceId ?? '');

  // ── Storytelling mode ────────────────────────────────────────────────────────
  const [storyMode,    setStoryMode]    = useState(true);
  const [storyVisible, setStoryVisible] = useState(false);
  const storyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cinematic tour ───────────────────────────────────────────────────────────
  // Per-space duration: activeSpace.guidedDuration (seconds) × 1000, fallback 10s
  const [isCinematic,      setIsCinematic]      = useState(false);
  const [cinematicPaused,  setCinematicPaused]  = useState(false);
  const [showCinematicEnd, setShowCinematicEnd] = useState(false);
  const [cpTick,           setCpTick]           = useState(false); // drives progress animation
  const cinematicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidedAutoStartedRef = useRef(false);

  // ── Contextual minimap ───────────────────────────────────────────────────────
  /** True while the minimap should be visible (briefly after space change) */
  const [showMinimap,    setShowMinimap]    = useState(false);
  const minimapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function payloadValue(payload: Record<string, unknown> | null | undefined, key: string): string {
    const value = payload?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  function guidedConfigValue(key: string): string {
    if (!guidedConfig || typeof guidedConfig !== 'object') return '';
    const value = (guidedConfig as Record<string, unknown>)[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  function guidedFinalPayloadValue(key: string): string {
    const payload = guidedConfig?.finalActionPayload;
    return payloadValue(payload ?? null, key);
  }

  function isGuidedEnabled(): boolean {
    return guidedConfig?.enabled === true;
  }

  function isSafePublicUrl(raw: string): boolean {
    try {
      const parsed = new URL(raw, window.location.origin);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  function openSafeUrl(raw: string): boolean {
    if (!isSafePublicUrl(raw)) return false;
    window.open(raw, '_blank', 'noopener,noreferrer');
    return true;
  }

  function getHotspotActionType(hotspot: Hotspot): string {
    const explicit = String(hotspot.actionType ?? '').trim().toLowerCase();
    if (explicit) return explicit;
    if (hotspot.type === 'navigation') return 'navigate';
    if (hotspot.type === 'cta') return 'lead_form';
    return 'info';
  }

  function getLeadContext(source: string, hotspot?: Hotspot, overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return {
      source,
      propertyId,
      spaceId: activeSpace?.id,
      spaceName: activeSpace?.name,
      assetId: activeAsset?.id,
      hotspotId: hotspot?.id,
      hotspotLabel: hotspot?.label,
      actionType: hotspot ? getHotspotActionType(hotspot) : overrides.actionType,
      ctaLabel: hotspot?.ctaLabel || overrides.ctaLabel,
      sessionId: sessionId.current,
      origin: window.location.origin,
      referrer: document.referrer || undefined,
      ...overrides
    };
  }

  function trackHotspotAction(type: string, hotspot: Hotspot, extra: Record<string, unknown> = {}): void {
    const actionType = getHotspotActionType(hotspot);
    trackToBackend({
      propertyId,
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      hotspotId: hotspot.id,
      type,
      label: hotspot.trackingLabel || hotspot.label,
      payload: {
        hotspotLabel: hotspot.label,
        actionType,
        ctaLabel: hotspot.ctaLabel,
        ...extra
      },
      sessionId: sessionId.current
    });
  }

  function executeHotspotAction(hotspot: Hotspot): void {
    const actionType = getHotspotActionType(hotspot);
    const payload = hotspot.actionPayload ?? {};
    trackHotspotAction('hotspot_action_clicked', hotspot);

    if (actionType === 'navigate') {
      const targetSpaceId = hotspot.targetSpaceId || payloadValue(payload, 'targetSpaceId');
      if (!targetSpaceId) return;
      transitionIntentRef.current = 'hotspot';
      driftRef.current = computeDrift(hotspot.position);
      runTransition(() => { handleSpaceChange(targetSpaceId); }, targetSpaceId);
      return;
    }

    if (actionType === 'lead_form') {
      setActiveHotspot(hotspot);
      setLeadContext(getLeadContext('hotspot_action', hotspot));
      setShowLeadModal(true);
      trackHotspotAction('hotspot_lead_opened', hotspot);
      return;
    }

    if (actionType === 'whatsapp') {
      const rawNumber = payloadValue(payload, 'phone') || payloadValue(payload, 'number') || tenantWhatsapp;
      const phone = rawNumber.replace(/\D/g, '');
      if (!phone) return;
      const message = payloadValue(payload, 'message') || `Hola, me interesa esta propiedad: ${propertyTitle ?? ''}`;
      if (openSafeUrl(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`)) {
        trackHotspotAction('hotspot_external_opened', hotspot, { destination: 'whatsapp' });
      }
      return;
    }

    if (actionType === 'calendly') {
      const url = payloadValue(payload, 'url') || tenantCalendlyUrl;
      if (openSafeUrl(url)) {
        trackHotspotAction('hotspot_external_opened', hotspot, { destination: 'calendly' });
      }
      return;
    }

    if (actionType === 'external_link') {
      if (openSafeUrl(payloadValue(payload, 'url'))) {
        trackHotspotAction('hotspot_external_opened', hotspot, { destination: 'external_link' });
      }
      return;
    }

    if (actionType === 'image' || actionType === 'video') {
      const url = payloadValue(payload, 'url');
      if (!isSafePublicUrl(url)) return;
      setMediaModal({
        type: actionType,
        url,
        title: payloadValue(payload, 'title') || hotspot.label,
        description: payloadValue(payload, 'description') || hotspot.body
      });
      trackHotspotAction('hotspot_media_opened', hotspot, { mediaType: actionType });
      return;
    }

    setActiveHotspot(hotspot);
    if (desktopImmersive) setInfoPanelOpen(true);
  }

  function trackGuided(type: string, extra: Record<string, unknown> = {}): void {
    trackToBackend({
      propertyId,
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      type,
      label: activeSpace?.name,
      payload: {
        stepOrder: currentSpaceIdx + 1,
        stepTitle: activeSpace?.storySubheadline || activeSpace?.name,
        source: 'guided_autopilot',
        ...extra
      },
      sessionId: sessionId.current
    });
  }

  function executeGuidedFinalCta(): void {
    const finalAction = guidedConfigValue('finalActionType') || 'lead_form';
    const finalCtaLabel = guidedConfigValue('finalCtaLabel') || t(language, 'request_visit');
    trackGuided('guided_cta_clicked', { actionType: finalAction, ctaLabel: finalCtaLabel });

    if (finalAction === 'whatsapp') {
      const rawNumber = guidedFinalPayloadValue('phone') || guidedFinalPayloadValue('url') || tenantWhatsapp;
      const phone = rawNumber.replace(/\D/g, '');
      if (phone) {
        openSafeUrl(`https://wa.me/${phone}?text=${encodeURIComponent(`Hola, quiero hacer una visita guiada de ${propertyTitle ?? 'esta propiedad'}`)}`);
      }
      return;
    }

    if (finalAction === 'calendly') {
      openSafeUrl(guidedFinalPayloadValue('url') || tenantCalendlyUrl);
      return;
    }

    if (finalAction === 'external_link') {
      openSafeUrl(guidedFinalPayloadValue('url'));
      return;
    }

    handleLeadCtaOpen(getLeadContext('guided_autopilot', undefined, {
      actionType: finalAction,
      ctaLabel: finalCtaLabel,
      guidedStepId: activeSpace?.id,
      guidedStepTitle: activeSpace?.storySubheadline || activeSpace?.name
    }));
    trackGuided('guided_lead_opened', { actionType: finalAction, ctaLabel: finalCtaLabel });
  }

  // Track initial viewer open
  useEffect(() => {
    if (!activeSpace) return;
    spaceEnteredAt.current = Date.now();
    activeSpaceIdRef.current = activeSpace.id;
    trackToBackend({
      propertyId,
      spaceId: activeSpace.id,
      type: 'viewer_opened',
      sessionId: sessionId.current
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (guidedAutoStartedRef.current || sortedSpaces.length < 2 || !isGuidedEnabled()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('guided') !== '1') return;
    guidedAutoStartedRef.current = true;
    window.setTimeout(() => { startCinematicTour(); }, 350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedSpaces.length]);

  // Fullscreen listener
  useEffect(() => {
    function onFullscreenChange(): void {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Keep refs current for cleanup callbacks
  useEffect(() => { activeSpaceIdRef.current = activeSpaceId; }, [activeSpaceId]);

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

  // Cleanup audio + cinematic + minimap + space_time on unmount
  useEffect(() => {
    return () => {
      // Fire space_time for the last space before unmount (fire-and-forget)
      const durationMs = Date.now() - spaceEnteredAt.current;
      const sid = activeSpaceIdRef.current;
      if (durationMs > 500 && sid) {
        trackToBackend({
          propertyId,
          spaceId: sid,
          type: 'space_time',
          payload: { durationMs, fromSpaceId: sid },
          sessionId: sessionId.current
        });
      }
      cancelAnimationFrame(fadeOutRafId.current);
      cancelAnimationFrame(fadeInRafId.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
      if (minimapTimerRef.current)   clearTimeout(minimapTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cinematic auto-advance — duration from activeSpace.guidedDuration (seconds), fallback 10s
  useEffect(() => {
    if (!isCinematic || cinematicPaused || showCinematicEnd || prefersReducedMotion) {
      if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
      return;
    }
    const spaceDurationMs = (activeSpace?.guidedDuration ?? 10) * 1000;
    if (cinematicTimerRef.current) clearTimeout(cinematicTimerRef.current);
    cinematicTimerRef.current = setTimeout(() => {
      const curIdx = sortedSpaces.findIndex((s) => s.id === activeSpaceId);
      const isLast = curIdx < 0 || curIdx >= sortedSpaces.length - 1;
      if (isLast) {
        trackGuided('guided_step_completed', { stepOrder: curIdx + 1 });
        trackGuided('guided_completed', { totalSteps: sortedSpaces.length });
        setShowCinematicEnd(true);
      } else {
        const nextSpace = sortedSpaces[curIdx + 1]!;
        trackGuided('guided_step_completed', { stepOrder: curIdx + 1 });
        trackToBackend({
          propertyId,
          spaceId: nextSpace.id,
          type: 'guided_step_viewed',
          label: nextSpace.name,
          payload: { source: 'guided_autopilot', stepOrder: curIdx + 2, stepTitle: nextSpace.storySubheadline || nextSpace.name },
          sessionId: sessionId.current
        });
        runTransition(() => { handleSpaceChange(nextSpace.id); }, nextSpace.id);
      }
    }, spaceDurationMs);
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
      type: 'guided_tour_started',
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
    if (prefersReducedMotion || !isGuidedEnabled()) return;
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
    trackToBackend({
      propertyId,
      spaceId: firstSpace?.id ?? activeSpaceId,
      type: 'guided_started',
      label: 'Visita guiada automática',
      payload: { source: 'guided_autopilot', totalSteps: sortedSpaces.length },
      sessionId: sessionId.current
    });
    trackToBackend({
      propertyId,
      spaceId: firstSpace?.id ?? activeSpaceId,
      type: 'guided_step_viewed',
      label: firstSpace?.name,
      payload: { source: 'guided_autopilot', stepOrder: 1, stepTitle: firstSpace?.storySubheadline || firstSpace?.name },
      sessionId: sessionId.current
    });
  }

  function stopCinematicTour(): void {
    if (isCinematic) {
      trackGuided('guided_exited');
    }
    setIsCinematic(false);
    setCinematicPaused(false);
    setShowCinematicEnd(false);
    if (cinematicTimerRef.current) {
      clearTimeout(cinematicTimerRef.current);
      cinematicTimerRef.current = null;
    }
  }

  function toggleCinematicPause(): void {
    setCinematicPaused((paused) => {
      trackGuided(paused ? 'guided_resumed' : 'guided_paused');
      return !paused;
    });
  }

  function stepCinematicTour(dir: 1 | -1): void {
    const curIdx = sortedSpaces.findIndex((space) => space.id === activeSpaceId);
    const nextIdx = curIdx + dir;
    if (nextIdx < 0 || nextIdx >= sortedSpaces.length) return;
    const nextSpace = sortedSpaces[nextIdx];
    if (!nextSpace) return;
    setShowCinematicEnd(false);
    setCinematicPaused(true);
    trackGuided('guided_skipped', { direction: dir > 0 ? 'next' : 'prev', targetStepOrder: nextIdx + 1 });
    trackToBackend({
      propertyId,
      spaceId: nextSpace.id,
      type: 'guided_step_viewed',
      label: nextSpace.name,
      payload: { source: 'guided_autopilot', stepOrder: nextIdx + 1, stepTitle: nextSpace.storySubheadline || nextSpace.name },
      sessionId: sessionId.current
    });
    runTransition(() => {
      setActiveSpaceId(nextSpace.id);
      setActiveHotspot(null);
    }, nextSpace.id);
  }

  function stepGuidedTour(dir: 1 | -1): void {
    const newIdx = guidedTourIdx + dir;
    if (newIdx < 0 || newIdx >= sortedSpaces.length) return;
    const nextSpace = sortedSpaces[newIdx];
    if (!nextSpace) return;

    const isLast     = newIdx === sortedSpaces.length - 1;
    const eventType: ViewerEvent['type'] = isLast ? 'tour_complete' : 'tour_step';
    // Map to current naming convention for backend; local event type stays for onAnalyticsEvent
    const backendType = isLast ? 'guided_tour_completed' : 'tour_step';
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
      type: backendType,
      label: nextSpace.name,
      payload,
      sessionId: sessionId.current
    });

    transitionIntentRef.current = 'nav'; // cinematic zoom for guided tour steps
    runTransition(() => {
      setGuidedTourIdx(newIdx);
      setActiveSpaceId(nextSpace.id);
      setActiveHotspot(null);
    }, nextSpace.id);
  }

  // ── Cinematic drift helper ───────────────────────────────────────────────────

  /**
   * Compute a micro drift vector (px) from a hotspot's HotspotPosition.
   *
   * Position x and y are percentages (0–100) of the viewer canvas:
   *   x = 50  →  center  →  no horizontal drift
   *   x > 50  →  right   →  drift right  (+px)
   *   x < 50  →  left    →  drift left   (–px)
   *   y = 50  →  middle  →  no vertical drift
   *   y > 50  →  below   →  drift down   (+py, half weight)
   *   y < 50  →  above   →  drift up     (–py, half weight)
   *
   * Max drift: 8 px desktop, 4 px mobile (within 6–10 / 3–5 px spec).
   * ONLY applied for `transitionIntentRef === 'hotspot'` navigation transitions;
   * never for 'nav' (room-bar click) or '' (cinematic auto) — see call sites.
   */
  function computeDrift(pos: HotspotPosition): { x: number; y: number } {
    const maxPx = isTouchDevice.current ? 4 : 8;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const x = clamp((pos.x - 50) / 50) * maxPx;
    const y = clamp((pos.y - 50) / 50) * maxPx * 0.5;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }

  // ── Cinematic transition runner ──────────────────────────────────────────────

  function runTransition(swapFn: () => void, targetId: string): void {
    if (transitionLock.current) {
      pendingSpaceRef.current = targetId;  // last click wins
      pendingSwapRef.current  = swapFn;
      return;
    }
    transitionLock.current = true;
    // Cinematic durations: fade-out 400ms → swap → fade-in 400ms
    // Touch is slightly faster (300ms) to feel responsive; reduced-motion is instant
    const msOut = prefersReducedMotion ? 0 : isTouchDevice.current ? 300 : 400;
    const msIn  = prefersReducedMotion ? 0 : isTouchDevice.current ? 280 : 380;
    setTPhase('out');
    setTimeout(() => {
      swapFn();
      setTPhase('in');
      setTimeout(() => {
        transitionIntentRef.current = ''; // clear before idle render so scale/drift resets cleanly
        driftRef.current = { x: 0, y: 0 };
        setTPhase('idle');
        transitionLock.current = false;
        const pendingId = pendingSpaceRef.current;
        const pendingFn = pendingSwapRef.current;
        pendingSpaceRef.current = null;
        pendingSwapRef.current  = null;
        if (pendingId && pendingFn) {
          runTransition(pendingFn, pendingId);
        }
      }, msIn);
    }, msOut);
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

    // Append to spatial breadcrumb trail (no consecutive duplicates, cap at 12)
    setVisitHistory((prev) => {
      if (prev[prev.length - 1] === spaceId) return prev;
      const next = [...prev, spaceId];
      return next.length > 12 ? next.slice(-12) : next;
    });

    setIsMeasuring(false);
    setShowDollhouse(false);
    setActiveSpaceId(spaceId);
    setActiveHotspot(null);

    // Contextual minimap: flash the floorplan briefly to orient the user.
    // Only when a floorplan exists, not in dollhouse/plano mode, not reduced-motion.
    if (floorplanUrl && !showDollhouse && !prefersReducedMotion) {
      if (minimapTimerRef.current) clearTimeout(minimapTimerRef.current);
      setShowMinimap(true);
      minimapTimerRef.current = setTimeout(() => setShowMinimap(false), 3500);
    }

    // space_time: emit duration for the space we are leaving
    const durationMs = Date.now() - spaceEnteredAt.current;
    if (durationMs > 500 && activeSpaceIdRef.current) {
      trackToBackend({
        propertyId,
        spaceId: activeSpaceIdRef.current,
        type: 'space_time',
        payload: { durationMs, fromSpaceId: activeSpaceIdRef.current, toSpaceId: spaceId },
        sessionId: sessionId.current
      });
    }
    spaceEnteredAt.current = Date.now();

    const event = createViewerEvent('space_change', {
      spaceId,
      data: { propertyId, spaceName: nextSpace.name }
    });
    onAnalyticsEvent(event);
    trackToBackend({
      propertyId,
      spaceId,
      type: 'space_viewed',
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
      hotspotId: hotspot.id,
      type: 'hotspot_clicked',
      label: hotspot.label,
      payload: { hotspotType: hotspot.type, ...(hotspot.targetSpaceId ? { targetSpaceId: hotspot.targetSpaceId } : {}) },
      sessionId: sessionId.current
    });

    executeHotspotAction(hotspot);
  }

  function handleLeadCtaOpen(context?: Record<string, string | undefined>): void {
    if (disableLeadCapture) return; // grace period: readonly o blocked
    setLeadContext(context ?? getLeadContext('viewer_cta', activeHotspot ?? undefined));
    setShowLeadModal(true);
    trackToBackend({
      propertyId,
      spaceId: activeSpace?.id,
      type: 'cta_clicked',
      label: activeHotspot?.label ?? 'Tour guiado',
      sessionId: sessionId.current
    });
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
      type: leadContext?.source === 'guided_autopilot'
        ? 'guided_lead_submitted'
        : leadContext?.source === 'hotspot_action'
          ? 'hotspot_lead_submitted'
          : 'lead_submitted',
      label: activeHotspot?.label ?? 'Tour guiado',
      payload: leadContext,
      sessionId: sessionId.current
    });
  }

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (!activeSpace || !activeAsset) {
    return (
      <section className={`rounded-[1.6rem] bg-slate-950 p-6 text-white ${className}`}>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-300">
          {t(language, 'immersive_experience')}
        </p>
        <h2 className="mt-3 text-3xl font-black">{t(language, 'no_spaces')}</h2>
        <p className="mt-3 text-white/60">
          {t(language, 'no_spaces_body')}
        </p>
      </section>
    );
  }

  // ── Derived values for tour panel ────────────────────────────────────────────
  const tourDimensions  = formatSpaceDimensions(activeSpace.dimensions, language);
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

  // ── Cinematic zoom intent — drives the micro-scale wrapper ───────────────────
  // Uses a ref (not state) so the value is always current when the re-render triggered
  // by tPhase state change fires. Hotspot/nav get a more pronounced zoom than direct nav.
  const _cinIntent    = transitionIntentRef.current;
  const _isCinZoom    = tPhase !== 'idle' && !prefersReducedMotion && (_cinIntent === 'hotspot' || _cinIntent === 'nav');
  const _scaleOut     = _isCinZoom ? 1.042 : 1.018;
  const _blurOut      = _isCinZoom ? '9px'  : '6px';
  const _brightnessOut = _isCinZoom ? 0.5    : 0.7;
  // Directional drift: only during hotspot-intent transitions, only if reduced-motion is off.
  // During 'out' phase: apply drift vector so the scene appears to slide toward the target.
  // During 'in' and 'idle': always 0 — the CSS transition animates the snap back to center.
  const _isDrift  = tPhase !== 'idle' && !prefersReducedMotion && _cinIntent === 'hotspot';
  const _driftX   = _isDrift ? driftRef.current.x : 0;
  const _driftY   = _isDrift ? driftRef.current.y : 0;
  const shellClass = desktopImmersive
    ? `relative flex flex-col overflow-hidden rounded-[1.6rem] bg-slate-950 text-white lg:h-[100dvh] lg:min-h-[720px] lg:rounded-none ${className} ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''}`
    : `relative flex flex-col overflow-hidden rounded-[1.6rem] bg-slate-950 text-white ${className} ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''}`;
  const headerClass = desktopImmersive
    ? 'flex flex-col gap-4 border-b border-white/10 p-5 lg:absolute lg:left-4 lg:right-4 lg:top-4 lg:z-40 lg:flex-row lg:items-center lg:justify-between lg:rounded-2xl lg:border lg:border-white/10 lg:bg-slate-950/65 lg:p-2 lg:pl-3 lg:shadow-2xl lg:backdrop-blur-xl'
    : 'flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between';
  const mainGridClass = desktopImmersive
    ? 'grid min-h-0 flex-1 grid-cols-1 lg:block'
    : 'grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_300px]';
  const viewerAreaClass = desktopImmersive
    ? 'relative min-h-[560px] p-5 lg:h-full lg:min-h-0 lg:p-0'
    : 'relative min-h-[560px] p-5 lg:min-h-0';
  const asideClass = desktopImmersive
    ? `border-t border-white/10 bg-white/[0.04] p-5 lg:absolute lg:bottom-4 lg:right-4 lg:top-[5.5rem] lg:z-50 lg:w-[320px] lg:overflow-y-auto lg:rounded-2xl lg:border lg:border-white/10 lg:bg-slate-950/82 lg:shadow-2xl lg:backdrop-blur-xl lg:transition-all lg:duration-200 ${infoPanelOpen ? 'lg:pointer-events-auto lg:translate-x-0 lg:opacity-100' : 'lg:pointer-events-none lg:translate-x-6 lg:opacity-0'}`
    : 'border-t border-white/10 bg-white/[0.04] p-5 lg:overflow-y-auto lg:border-l lg:border-t-0';

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <section
      ref={viewerRef}
      className={shellClass}
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
          {/* Agency logo or accent line — parallax layer A */}
          {agencyLogoUrl ? (
            <img
              src={agencyLogoUrl}
              alt={agencyName ?? ''}
              className="mb-8 max-h-10 max-w-[140px] object-contain opacity-80"
              style={{
                transform: 'translate(calc(var(--px, 0px) * 1.2), calc(var(--py, 0px) * 0.8))',
                transition: 'transform 80ms linear',
              }}
            />
          ) : (
            <div
              className="mb-10 h-px w-10 rounded-full"
              style={{
                backgroundColor: primaryColor,
                transform: 'translate(calc(var(--px, 0px) * 1.2), calc(var(--py, 0px) * 0.8))',
                transition: 'transform 80ms linear',
              }}
            />
          )}

          {/* Property title — parallax layer B (lighter) */}
          <h2
            className="max-w-xs text-center text-2xl font-black leading-snug tracking-tight text-white"
            style={{
              transform: 'translate(calc(var(--px, 0px) * 0.5), calc(var(--py, 0px) * 0.35))',
              transition: 'transform 80ms linear',
            }}
          >
            {propertyTitle ?? sortedSpaces[0]?.name ?? t(language, 'immersive_experience')}
          </h2>

          {/* Agency name / subtitle */}
          <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.28em] text-white/35">
            {agencyName ?? t(language, 'immersive_experience')}
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

      {showLeadModal && !disableLeadCapture ? (
        <LeadCaptureModal
          propertyId={propertyId}
          hotspotLabel={leadModalLabel}
          primaryColor={primaryColor}
          agencyName={agencyName}
          lang={language}
          context={leadContext}
          onClose={() => { setShowLeadModal(false); setLeadContext(undefined); }}
          onSubmitted={() => { handleLeadSubmitted(); }}
        />
      ) : null}

      {mediaModal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setMediaModal(null); }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-[1.6rem] bg-slate-950 text-white shadow-2xl ring-1 ring-white/10">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  {mediaModal.type === 'image' ? 'Imagen' : 'Vídeo'}
                </p>
                <h3 className="mt-1 text-xl font-black">{mediaModal.title}</h3>
                {mediaModal.description ? (
                  <p className="mt-1 text-sm text-white/50">{mediaModal.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setMediaModal(null)}
                className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-black">
              {mediaModal.type === 'image' ? (
                <img
                  src={mediaModal.url}
                  alt={mediaModal.title}
                  loading="lazy"
                  className="max-h-[72vh] w-full object-contain"
                />
              ) : (
                <video
                  src={mediaModal.url}
                  controls
                  preload="metadata"
                  className="max-h-[72vh] w-full"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={headerClass}>
        <div className={desktopImmersive ? 'flex min-w-0 items-center gap-3' : ''}>
          {desktopImmersive ? (
            <button
              type="button"
              onClick={onBack}
              className="hidden shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-white/75 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
          ) : null}
          <div className="min-w-0">
          {/* Tour counter always visible — it's UX, not branding */}
          {isCinematic ? (
            <p className={`${desktopImmersive ? 'text-[10px]' : 'text-sm'} font-black uppercase tracking-[0.22em] text-violet-300`}>
              {cinematicPaused ? t(language, 'cinematic_paused_label') : t(language, 'cinematic_live')} · {currentSpaceIdx + 1} / {sortedSpaces.length}
            </p>
          ) : isGuidedTour ? (
            <p className={`${desktopImmersive ? 'text-[10px]' : 'text-sm'} font-black uppercase tracking-[0.22em] text-violet-300`}>
              {t(language, 'guided_tour')} · {guidedTourIdx + 1} / {sortedSpaces.length}
            </p>
          ) : !removeBranding ? (
            <p className={`${desktopImmersive ? 'text-[10px]' : 'text-sm'} font-black uppercase tracking-[0.22em] text-violet-300`}>
              {t(language, 'immersive_tour')}
            </p>
          ) : null}
          <h2 className={`${desktopImmersive ? 'truncate text-lg lg:max-w-[220px]' : 'mt-2 text-3xl'} font-black`}>{activeSpace.name}</h2>

          {/* ── Spatial breadcrumb trail — visible from 2nd space visited ── */}
          {visitHistory.length >= 2 ? (
            <div className="mt-1.5 flex items-center gap-1 overflow-hidden">
              {visitHistory.slice(-5).map((sid, idx, arr) => {
                const sp = sortedSpaces.find((s) => s.id === sid);
                if (!sp) return null;
                const isLast = idx === arr.length - 1;
                return (
                  <span key={`${sid}-${idx}`} className="flex min-w-0 items-center gap-1">
                    {idx > 0 ? (
                      <span className="shrink-0 text-[10px] leading-none text-white/15">›</span>
                    ) : null}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => {
                        if (!isLast) runTransition(() => handleSpaceChange(sid), sid);
                      }}
                      className={`max-w-[72px] truncate text-[11px] font-bold transition ${
                        isLast
                          ? 'cursor-default text-white/45'
                          : 'text-white/22 hover:text-white/50'
                      }`}
                    >
                      {sp.name}
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}

          {!removeBranding ? (
            <p className={`${desktopImmersive ? 'hidden' : 'mt-2'} max-w-2xl text-sm leading-6 text-white/55`}>
              {activeAsset.type === 'panorama_360'
                ? t(language, 'panorama_360')
                : activeAsset.type === 'gaussian_splat'
                  ? t(language, 'immersive_view')
                  : t(language, 'model_3d')}
            </p>
          ) : null}
          </div>
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
                  onClick={toggleCinematicPause}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${
                    cinematicPaused
                      ? 'bg-white/10 text-white/60 hover:bg-white/15'
                      : 'bg-violet-600/70 text-white hover:bg-violet-600'
                  }`}
                  title={cinematicPaused ? t(language, 'resume_tour_title') : t(language, 'pause_tour_title')}
                >
                  {cinematicPaused ? t(language, 'resume_header') : t(language, 'pause_header')}
                </button>
                <button
                  type="button"
                  onClick={stopCinematicTour}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/40 transition hover:bg-white/15 hover:text-white/70"
                >
                  {t(language, 'stop_tour')}
                </button>
              </>
            ) : isGuidedTour ? (
              <button
                type="button"
                onClick={exitGuidedTour}
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-amber-300"
              >
                {t(language, 'exit_tour_header')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startGuidedTour}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
                >
                  {t(language, 'tour_btn')}
                </button>
                {!prefersReducedMotion && isGuidedEnabled() ? (
                  <button
                    type="button"
                    onClick={startCinematicTour}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
                    title="Ver visita guiada"
                  >
                    Ver visita guiada
                  </button>
                ) : null}
              </>
            )
          ) : null}

          {/* Plano — only shown when a real floorplan image exists */}
          {floorplanUrl ? (
            <button
              type="button"
              onClick={() => {
                setIsMeasuring(false);
                const opening = !showDollhouse;
                setShowDollhouse(opening);
                // Hide minimap when entering/exiting the floorplan view
                setShowMinimap(false);
                if (minimapTimerRef.current) clearTimeout(minimapTimerRef.current);
                if (opening) {
                  trackToBackend({
                    propertyId,
                    spaceId: activeSpace?.id,
                    type: 'floorplan_opened',
                    sessionId: sessionId.current
                  });
                }
              }}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                showDollhouse
                  ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
                  : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              {showDollhouse ? t(language, 'floorplan_back') : t(language, 'floorplan_open')}
            </button>
          ) : null}

          {/* Fullscreen — useful for demos, clean single button */}
          {document.fullscreenEnabled ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? t(language, 'fullscreen_exit') : t(language, 'fullscreen_enter')}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
            >
              {isFullscreen ? '⊠' : '⛶'}
            </button>
          ) : null}

          {desktopImmersive ? (
            <button
              type="button"
              onClick={() => setInfoPanelOpen((value) => !value)}
              className={`hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition lg:inline-flex ${
                infoPanelOpen
                  ? 'bg-white text-slate-950'
                  : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              <Info className="h-4 w-4" /> Info
            </button>
          ) : null}

          {/* ··· Advanced tools — not for visitors, not for the demo pitch */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { setShowTools((v) => !v); }}
              title={t(language, 'tools_title')}
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
                  <span>{isMeasuring ? t(language, 'measuring') : t(language, 'measure_space')}</span>
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
                  <span>{storyMode ? t(language, 'story_on') : t(language, 'story_off')}</span>
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
                    <span>{audioMuted ? t(language, 'audio_muted') : t(language, 'audio_active')}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className={mainGridClass}>

        {/* Viewer area */}
        <div
          className={viewerAreaClass}
          onPointerDown={() => {
            // Pause cinematic on any direct viewer interaction (drag, tap on panorama)
            if (isCinematic && !cinematicPaused) setCinematicPaused(true);
          }}
        >
          {/* Cinematic transition overlay — fades to black between spaces, stays visible until idle */}
          <div
            className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-slate-950 ${desktopImmersive ? 'lg:rounded-none' : 'rounded-[1.5rem]'}`}
            style={{
              opacity: tPhase !== 'idle' ? 1 : 0,
              transition: prefersReducedMotion
                ? 'none'
                : tPhase === 'out'
                  ? `opacity ${isTouchDevice.current ? 300 : 400}ms cubic-bezier(0.4,0,0.2,1)`
                  : `opacity ${isTouchDevice.current ? 280 : 380}ms cubic-bezier(0.4,0,0.2,1)`,
            }}
          >
            {!prefersReducedMotion && tPhase === 'in' ? (
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/25"
                style={{
                  transform: 'translate(calc(var(--px, 0px) * 0.6), calc(var(--py, 0px) * 0.4))',
                  transition: 'transform 80ms linear',
                  animation: 'fade-label 380ms ease forwards',
                }}
              >
                {/* Space name appears briefly during the black frame */}
              </p>
            ) : null}
          </div>
          {/* Micro-scale wrapper — subtle parallax on desktop only, not on mobile/reduced-motion */}
          <div
            className="h-full"
            style={!prefersReducedMotion ? {
              // _scaleOut: 1.042 for hotspot/nav intent, 1.018 for regular transitions.
              // During 'in' phase the element starts at whatever _scaleOut was (CSS holds last value)
              // and transitions to scale(1) — giving the "breathing open" zoom-out on entry.
              // _driftX/Y: directional micro-drift from hotspot.position (yaw/pitch).
              // Only for 'hotspot' intent; never for 'nav' or CTA/info hotspots.
              // translate is applied before scale so it operates in pre-scale screen space.
              transform: tPhase === 'out'
                ? `translateX(${_driftX}px) translateY(${_driftY}px) scale(${_scaleOut})`
                : `translateX(0px) translateY(0px) scale(1)`,
              filter: tPhase === 'out'
                ? `blur(${_blurOut}) brightness(${_brightnessOut})`
                : tPhase === 'in'
                  ? 'blur(2px) brightness(0.85)'
                  : 'blur(0px) brightness(1)',
              transition: tPhase === 'out'
                ? 'transform 400ms cubic-bezier(0.4,0,0.2,1), filter 400ms cubic-bezier(0.4,0,0.2,1)'
                : 'transform 380ms cubic-bezier(0.4,0,0.2,1), filter 380ms cubic-bezier(0.4,0,0.2,1)',
            } : undefined}
          >
          <ViewerErrorBoundary key={`eb-${activeSpace.id}`} lang={language}>
            {showDollhouse && floorplanUrl ? (
              <FloorplanViewer
                floorplanUrl={floorplanUrl}
                spaces={sortedSpaces}
                activeSpaceId={activeSpace.id}
                primaryColor={primaryColor}
                lang={language}
                onSpaceClick={(spaceId) => {
                  trackToBackend({
                    propertyId,
                    spaceId,
                    type: 'pin_clicked',
                    sessionId: sessionId.current
                  });
                  runTransition(() => { handleSpaceChange(spaceId); setShowDollhouse(false); }, spaceId);
                }}
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
                onAssetLoadError={({ assetId, assetUrl, assetType, message }) => {
                  trackToBackend({
                    propertyId,
                    spaceId: activeSpace.id,
                    assetId,
                    type: 'asset_load_error',
                    payload: { assetUrl, assetType, message },
                    sessionId: sessionId.current
                  });
                }}
              />
            ) : activeAsset.type === 'gaussian_splat' ? (
              <Suspense
                key={`splat-${activeSpace.id}-${activeAsset.id}`}
                fallback={
                  <div className="flex min-h-[520px] items-center justify-center rounded-[1.5rem] bg-slate-950">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/10"
                        style={{ borderTopColor: primaryColor }}
                      />
                      <p className="text-sm font-bold text-white/40">{t(language, 'loading_3d')}</p>
                    </div>
                  </div>
                }
              >
                <GaussianSplatViewer
                  propertyId={propertyId}
                  spaceId={activeSpace.id}
                  asset={activeAsset}
                  primaryColor={primaryColor}
                  measureMode={isMeasuring}
                  isAdminMode={false}
                  lang={language}
                  onAnalyticsEvent={onAnalyticsEvent}
                />
              </Suspense>
            ) : activeAsset.type === 'luma_embed' ? (
              <Suspense
                key={`luma-${activeSpace.id}-${activeAsset.id}`}
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-black">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                }
              >
                <LumaEmbedViewer asset={activeAsset} />
              </Suspense>
            ) : activeAsset.type === 'supersplat_embed' ? (
              <Suspense
                key={`supersplat-${activeSpace.id}-${activeAsset.id}`}
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-black">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  </div>
                }
              >
                <SuperSplatEmbedViewer asset={activeAsset} />
              </Suspense>
            ) : (
              <Suspense
                key={`glb-${activeSpace.id}-${activeAsset.id}`}
                fallback={
                  <div className="flex min-h-[520px] items-center justify-center rounded-[1.5rem] bg-slate-800">
                    <p className="text-sm font-bold text-slate-400">{t(language, 'loading_3d')}</p>
                  </div>
                }
              >
                <GlbViewer
                  src={activeAsset.url}
                  alt={activeSpace.name}
                  autoRotate
                  cameraControls
                  ar={arEnabled}
                  className="min-h-[520px]"
                />
              </Suspense>
            )}
          </ViewerErrorBoundary>
          </div>{/* end micro-scale wrapper */}

          {/* ── Contextual minimap — spatial orientation after navigation ──── */}
          {floorplanUrl && !showDollhouse ? (
            <MinimapOverlay
              floorplanUrl={floorplanUrl}
              spaces={sortedSpaces}
              activeSpaceId={activeSpace.id}
              visible={showMinimap}
              primaryColor={primaryColor}
              prefersReducedMotion={prefersReducedMotion}
            />
          ) : null}

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
                    ? `width ${(activeSpace?.guidedDuration ?? 10) * 1000}ms linear`
                    : 'none',
                }}
              />
            </div>
          ) : null}

          {/* ── Cinematic end screen — CTA final ──────────────────────────── */}
          {showCinematicEnd ? (
            <div className={`pointer-events-auto absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-slate-950/92 px-8 text-center backdrop-blur-sm ${desktopImmersive ? 'lg:rounded-none' : 'rounded-[1.5rem]'}`}>
              <div className="h-px w-8 rounded-full" style={{ backgroundColor: primaryColor }} />
              <h3 className="max-w-[260px] text-2xl font-black leading-snug text-white">
                {propertyTitle ?? activeSpace.name}
              </h3>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-white/30">
                {t(language, 'tour_complete')}
              </p>
              <button
                type="button"
                onClick={executeGuidedFinalCta}
                className="mt-2 rounded-2xl px-6 py-4 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                {guidedConfigValue('finalCtaLabel') || t(language, 'request_visit')}
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
                {t(language, 'explore_again')}
              </button>
              <button
                type="button"
                onClick={stopCinematicTour}
                className="text-xs font-bold text-white/20 transition hover:text-white/45"
              >
                {t(language, 'exit_journey_text')}
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
                  onClick={() => { transitionIntentRef.current = 'nav'; runTransition(() => handleSpaceChange(prevSpace.id), prevSpace.id); }}
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
                  onClick={() => { transitionIntentRef.current = 'nav'; runTransition(() => handleSpaceChange(nextSpace.id), nextSpace.id); }}
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
        <aside className={asideClass}>
          {desktopImmersive ? (
            <div className="mb-4 hidden items-center justify-between border-b border-white/10 pb-3 lg:flex">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Info</p>
              <button
                type="button"
                onClick={() => setInfoPanelOpen(false)}
                className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar info"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {/* CINEMATIC PANEL — shown when cinematic tour active and no hotspot open */}
          {isCinematic && !activeHotspot ? (
            <>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  {cinematicPaused ? 'Visita guiada · En pausa' : 'Visita guiada automática'}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-white/50">
                  <span>{t(language, 'space_of', { n: currentSpaceIdx + 1, m: sortedSpaces.length })}</span>
                  {cinematicPaused ? (
                    <span className="text-amber-400/60">{t(language, 'cinematic_status_paused')}</span>
                  ) : (
                    <span className="text-violet-300/50">{t(language, 'cinematic_status_auto')}</span>
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
                        ? `width ${(activeSpace?.guidedDuration ?? 10) * 1000}ms linear`
                        : 'none',
                    }}
                  />
                </div>
                <h3 className="mt-4 text-2xl font-black">{activeSpace.name}</h3>
                <p className="mt-2 text-sm font-light italic leading-snug text-white/45">
                  {activeSpace.storySubheadline || activeSpace.storyHighlight || 'Recorrido comercial para entender la vivienda antes de desplazarte.'}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={currentSpaceIdx <= 0}
                  onClick={() => stepCinematicTour(-1)}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={toggleCinematicPause}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black transition ${
                    cinematicPaused
                      ? 'bg-violet-600/70 text-white hover:bg-violet-600'
                      : 'bg-white/10 text-white/70 hover:bg-white/15'
                  }`}
                >
                  {cinematicPaused ? t(language, 'resume') : t(language, 'pause')}
                </button>
                <button
                  type="button"
                  disabled={currentSpaceIdx >= sortedSpaces.length - 1}
                  onClick={() => stepCinematicTour(1)}
                  className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white/70 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                onClick={stopCinematicTour}
                className="mt-3 w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-bold text-white/40 transition hover:bg-white/10 hover:text-white/60"
              >
                {t(language, 'exit_journey')}
              </button>
            </>
          ) : /* GUIDED TOUR PANEL — shown when tour active and no hotspot is open */
          isGuidedTour && !activeHotspot ? (
            <>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  {t(language, 'guided_tour')}
                </p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-white/50">
                  <span>{t(language, 'space_of', { n: guidedTourIdx + 1, m: sortedSpaces.length })}</span>
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
                  {t(language, 'prev_space')}
                </button>
                {isLastTourStep ? (
                  <button
                    type="button"
                    onClick={() => handleLeadCtaOpen()}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {t(language, 'request_info')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => { stepGuidedTour(1); }}
                    className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {t(language, 'next_space')}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={exitGuidedTour}
                className="mt-3 w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-bold text-white/40 transition hover:bg-white/10 hover:text-white/60"
              >
                {t(language, 'exit_tour')}
              </button>
            </>
          ) : (
            /* DEFAULT / HOTSPOT PANEL */
            <>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  {t(language, 'active_space_label')}
                </p>
                <h3 className="mt-3 text-2xl font-black">{activeSpace.name}</h3>
                <p className="mt-2 text-sm text-white/55">
                  {activeAsset.type === 'panorama_360'
                    ? t(language, 'panorama_360')
                    : activeAsset.type === 'gaussian_splat'
                      ? t(language, 'immersive_view')
                      : t(language, 'model_3d')}
                  {activeSpace.dimensions?.width != null && activeSpace.dimensions?.depth != null
                    ? ` · ${activeSpace.dimensions.width} × ${activeSpace.dimensions.depth} m`
                    : ''}
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-white/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                  {t(language, 'information')}
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
                          {t(language, 'metric_label')}
                        </p>
                        <p className="mt-1 text-xl font-black">{activeHotspot.metric}</p>
                      </div>
                    ) : null}
                    {['lead_form', 'whatsapp', 'calendly', 'external_link', 'image', 'video'].includes(getHotspotActionType(activeHotspot)) ? (
                      <button
                        type="button"
                        onClick={() => executeHotspotAction(activeHotspot)}
                        className="mt-4 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {activeHotspot.ctaLabel || t(language, 'submit_cta')}
                      </button>
                    ) : null}
                    {/* Return to tour if guided tour is still active */}
                    {isGuidedTour ? (
                      <button
                        type="button"
                        onClick={() => setActiveHotspot(null)}
                        className="mt-3 w-full rounded-2xl bg-white/10 px-4 py-2 text-xs font-black text-white/60 transition hover:bg-white/15"
                      >
                        {t(language, 'back_to_tour')}
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
                        {t(language, 'select_hotspot')}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  /* Minimal fallback — no story content configured */
                  <p className="mt-4 text-xs leading-6 text-white/30">
                    {(activeAsset?.hotspots?.length ?? 0) > 0
                      ? t(language, 'select_hotspot')
                      : t(language, 'explore_360')}
                  </p>
                )}
              </div>

              {/* ── Contextual CTA — luxury action, integrated ─────────────── */}
              {activeSpace.ctaLabel ? (
                <div className="mt-5 border-t border-white/[0.06] pt-5">
                  <p className="mb-3 text-[0.58rem] font-bold uppercase tracking-[0.3em] text-white/30">
                    {t(language, 'next_step')}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleLeadCtaOpen(getLeadContext('viewer_cta', undefined, { ctaLabel: activeSpace.ctaLabel }))}
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
                  {t(language, 'featured_point')}
                </p>
                <h3 className="mt-1 text-xl font-black leading-snug">{activeHotspot.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => { setActiveHotspot(null); }}
                className="shrink-0 rounded-full p-2 text-white/40 transition hover:bg-white/10 hover:text-white"
                aria-label={t(language, 'close')}
              >
                ✕
              </button>
            </div>
            {activeHotspot.body ? (
              <p className="mt-4 text-sm leading-6 text-white/65">{activeHotspot.body}</p>
            ) : null}
            {activeHotspot.metric ? (
              <div className="mt-4 rounded-2xl bg-black/30 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">{t(language, 'metric_label')}</p>
                <p className="mt-1 text-xl font-black">{activeHotspot.metric}</p>
              </div>
            ) : null}
            {['lead_form', 'whatsapp', 'calendly', 'external_link', 'image', 'video'].includes(getHotspotActionType(activeHotspot)) ? (
              <button
                type="button"
                onClick={() => { setMobileSheetOpen(false); executeHotspotAction(activeHotspot); }}
                className="mt-5 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                {activeHotspot.ctaLabel || t(language, 'submit_cta')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
