import { useEffect, useRef, useState } from 'react';
import { PanoramaEngine360 } from '@/engines/PanoramaEngine360';
import MeasurementOverlay from '@/components/viewer/MeasurementOverlay';
import type { Hotspot, SpacePreview, ViewerAsset, ViewerEvent } from '@/types/viewer';

interface PanoramaViewerProps {
  propertyId: string;
  spaceId: string;
  asset: ViewerAsset;
  primaryColor?: string;
  measureMode?: boolean;
  spacePreviewMap?: Record<string, SpacePreview>;
  onHotspotClick: (hotspot: Hotspot) => void;
  onAnalyticsEvent: (event: ViewerEvent) => void;
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

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');

    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}


function createRuntimeFallbackPanoramaUrl(label: string): string {
  const safeLabel = (label || 'Immersphere Pro').replace(/[<>&"']/g, '');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024">
      <defs>
        <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#020617"/>
          <stop offset="35%" stop-color="#0f172a"/>
          <stop offset="70%" stop-color="#312e81"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.28"/>
          <stop offset="40%" stop-color="#22d3ee" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>

      <rect width="2048" height="1024" fill="url(#sky)"/>
      <rect width="2048" height="1024" fill="url(#glow)"/>

      <path d="M0 690 C260 600 420 740 690 650 C980 555 1180 760 1480 645 C1710 560 1870 650 2048 590 L2048 1024 L0 1024 Z" fill="#020617" opacity="0.72"/>
      <path d="M0 760 C330 670 500 840 800 735 C1080 635 1300 825 1620 720 C1810 660 1940 720 2048 690 L2048 1024 L0 1024 Z" fill="#020617" opacity="0.9"/>

      <g opacity="0.22">
        <line x1="0" y1="512" x2="2048" y2="512" stroke="#ffffff" stroke-width="2"/>
        <line x1="512" y1="0" x2="512" y2="1024" stroke="#ffffff" stroke-width="1"/>
        <line x1="1024" y1="0" x2="1024" y2="1024" stroke="#ffffff" stroke-width="1"/>
        <line x1="1536" y1="0" x2="1536" y2="1024" stroke="#ffffff" stroke-width="1"/>
      </g>

      <text x="1024" y="460" text-anchor="middle" font-family="Arial, sans-serif" font-size="76" font-weight="900" fill="#ffffff">${safeLabel}</text>
      <text x="1024" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#a5f3fc">Vista en preparación</text>
      <text x="1024" y="600" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#cbd5e1">Sube el panorama 360 para activar esta estancia</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getRuntimePanoramaUrl(asset: ViewerAsset, propertyId: string): string {
  const candidate = (asset.url ?? '').trim();

  if (candidate.length > 0 && !candidate.startsWith('demo://')) {
    return candidate;
  }

  return createRuntimeFallbackPanoramaUrl(asset.id || propertyId);
}

// ── Hotspot visual helpers ───────────────────────────────────────────────────

function getHotspotDotColor(type: Hotspot['type'], primaryColor: string): string {
  if (type === 'info') return 'rgba(255,255,255,0.85)';
  if (type === 'measurement') return '#38BDF8';
  return primaryColor; // navigation + cta = brand color
}

function getHotspotGlow(type: Hotspot['type'], primaryColor: string): string {
  if (type === 'navigation') return `0 0 14px ${primaryColor}55, 0 0 28px ${primaryColor}22`;
  if (type === 'cta')        return `0 0 10px ${primaryColor}44, 0 0 20px ${primaryColor}18`;
  if (type === 'info')       return '0 0 8px rgba(255,255,255,0.10)';
  return '0 0 6px rgba(56,189,248,0.22)'; // measurement
}

export default function PanoramaViewer({
  propertyId,
  spaceId,
  asset,
  primaryColor = '#7C3AED',
  measureMode = false,
  spacePreviewMap,
  onHotspotClick,
  onAnalyticsEvent
}: PanoramaViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PanoramaEngine360 | null>(null);
  const currentFovRef = useRef(75);
  const analyticsRef = useRef(onAnalyticsEvent);
  const hotspotClickRef = useRef(onHotspotClick);

  const runtimeImageUrl = getRuntimePanoramaUrl(asset, propertyId);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentFov, setCurrentFov] = useState(75);
  const [gyroActive, setGyroActive] = useState(false);
  const [gyroPermDenied, setGyroPermDenied] = useState(false);
  const supportsGyro = typeof DeviceOrientationEvent !== 'undefined' && navigator.maxTouchPoints > 0;
  const [vrSupported, setVrSupported] = useState(false);
  const [vrActive, setVrActive] = useState(false);

  // ── Hotspot preview card ─────────────────────────────────────────────────────
  const [previewHotspotId, setPreviewHotspotId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressWas   = useRef(false);

  useEffect(() => {
    analyticsRef.current = onAnalyticsEvent;
  }, [onAnalyticsEvent]);

  useEffect(() => {
    hotspotClickRef.current = onHotspotClick;
  }, [onHotspotClick]);

  useEffect(() => {
    if (!navigator.xr) return;
    navigator.xr.isSessionSupported('immersive-vr')
      .then((supported) => setVrSupported(supported))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    if (!supportsWebGL()) {
      const event = createViewerEvent('viewer_error', {
        spaceId,
        assetId: asset.id,
        data: {
          reason: 'webgl_not_supported',
          propertyId
        }
      });

      setErrorMessage('Este navegador no soporta WebGL. Se muestra fallback estático.');
      analyticsRef.current(event);
      return;
    }

    try {
      const engine = new PanoramaEngine360({
        container,
        imageUrl: runtimeImageUrl,
        initialYaw: 0,
        initialPitch: 0,
        initialFov: currentFovRef.current,
        onReady: () => {
          setIsReady(true);
          setErrorMessage(null);

          analyticsRef.current(
            createViewerEvent('viewer_ready', {
              spaceId,
              assetId: asset.id,
              data: {
                propertyId,
                assetType: asset.type
              }
            })
          );
        },
        onError: (error) => {
          setIsReady(false);
          setErrorMessage(error.message);

          analyticsRef.current(
            createViewerEvent('viewer_error', {
              spaceId,
              assetId: asset.id,
              data: {
                propertyId,
                message: error.message
              }
            })
          );
        },
        onViewChange: (state) => {
          currentFovRef.current = state.fov;
          setCurrentFov(state.fov);
        }
      });

      engineRef.current = engine;
      void engine.load(runtimeImageUrl);

      const handleResize = (): void => {
        engine.resize();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        engine.dispose();
        engineRef.current = null;
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo inicializar el visor 360°.';

      setIsReady(false);
      setErrorMessage(message);

      analyticsRef.current(
        createViewerEvent('viewer_error', {
          spaceId,
          assetId: asset.id,
          data: {
            propertyId,
            message
          }
        })
      );
    }
  }, [asset.id, asset.type, propertyId, runtimeImageUrl, spaceId]);

  function handleHotspotClick(hotspot: Hotspot): void {
    hotspotClickRef.current(hotspot);

    analyticsRef.current(
      createViewerEvent('hotspot_click', {
        spaceId,
        assetId: asset.id,
        hotspotId: hotspot.id,
        data: {
          propertyId,
          label: hotspot.label,
          type: hotspot.type
        }
      })
    );
  }

  function handleZoom(delta: number): void {
    const currentState = engineRef.current?.getViewState();
    if (!currentState) return;

    // animateFovTo gives the premium ease-out feel on button press
    const targetFov = currentState.fov + delta;
    engineRef.current?.animateFovTo(targetFov, 250);

    // Optimistic UI update — the engine will emit onViewChange as it animates
    const clamped = Math.min(Math.max(targetFov, 35), 95);
    currentFovRef.current = clamped;
    setCurrentFov(clamped);

    analyticsRef.current(
      createViewerEvent('zoom', {
        spaceId,
        assetId: asset.id,
        data: { propertyId, fov: clamped }
      })
    );
  }

  async function handleGyroToggle(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;

    if (gyroActive) {
      engine.disableGyroscope();
      setGyroActive(false);
    } else {
      await engine.enableGyroscope(() => {
        setGyroPermDenied(true);
      });
      setGyroActive(engine.isGyroscopeActive());
    }
  }

  async function handleVrToggle(): Promise<void> {
    const engine = engineRef.current;
    if (!engine) return;

    if (vrActive) {
      await engine.exitVR();
      setVrActive(false);
    } else {
      try {
        await engine.enterVR(() => setVrActive(false));
        setVrActive(engine.isInVR());
      } catch {
        // User cancelled the browser VR prompt or device rejected
      }
    }
  }

  function handleReset(): void {
    engineRef.current?.setYaw(0);
    engineRef.current?.setPitch(0);
    engineRef.current?.setFov(75);

    currentFovRef.current = 75;
    setCurrentFov(75);

    analyticsRef.current(
      createViewerEvent('reset', {
        spaceId,
        assetId: asset.id,
        data: {
          propertyId
        }
      })
    );
  }

  return (
    <div className="relative min-h-[520px] overflow-hidden rounded-[1.5rem] bg-slate-950">
      {/* Pulse animation for premium hotspots — very subtle breath, not gaming */}
      <style>{`
        @keyframes hs-breathe {
          0%, 100% { opacity: 0.18; transform: scale(1); }
          50%       { opacity: 0.32; transform: scale(1.08); }
        }
        .hs-ring { animation: hs-breathe 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .hs-ring { animation: none; opacity: 0.18; } }

        /* Skeleton shimmer sweep — single horizontal light pass */
        @keyframes sk-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .sk-sweep {
          animation: sk-sweep 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
        }
        @media (prefers-reduced-motion: reduce) { .sk-sweep { animation: none; } }
      `}</style>
      <div ref={containerRef} className="absolute inset-0" />

      {/* ── Skeleton loading state — shows until onReady fires ─────────────── */}
      {!isReady && !errorMessage ? (
        <div className="absolute inset-0 overflow-hidden bg-slate-950">
          {/* Base gradient — mimics the dark tones of a luxury interior panorama */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 120% 80% at 50% 40%, #1e1b2e 0%, #0f0f1a 55%, #080810 100%)',
            }}
          />

          {/* Shimmer sweep — single light pass */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="sk-sweep absolute inset-y-0 w-1/3"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.028) 50%, transparent 100%)',
              }}
            />
          </div>

          {/* Center content — space name (if available) + subtle indicator */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            {/* Space name from preview map */}
            {spacePreviewMap?.[spaceId]?.name ? (
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/18">
                {spacePreviewMap[spaceId].name}
              </p>
            ) : null}

            {/* Thin animated progress line */}
            <div className="h-px w-16 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="sk-sweep h-full w-1/2 rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${primaryColor}55, transparent)` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
            <p className="text-lg font-black">Vista no disponible</p>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Esta vista no pudo cargarse. Por favor, inténtalo de nuevo.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Hotspot preview micro-card ─────────────────────────────────── */}
      {(() => {
        if (!previewHotspotId || !spacePreviewMap) return null;
        const hs = asset.hotspots.find((h) => h.id === previewHotspotId);
        if (!hs?.targetSpaceId) return null;
        const preview = spacePreviewMap[hs.targetSpaceId];
        if (!preview) return null;
        const showAbove = hs.position.y > 50;
        const assetLabel = preview.assetType === 'panorama_360'
          ? 'Panorama 360°'
          : preview.assetType === 'gaussian_splat'
            ? 'Vista inmersiva'
            : 'Modelo 3D';
        return (
          <div
            className="pointer-events-none absolute z-40 w-[240px] overflow-hidden rounded-[1.4rem] text-white"
            style={{
              left: `clamp(8px, calc(${hs.position.x}% - 120px), calc(100% - 248px))`,
              top: showAbove
                ? `calc(${hs.position.y}% - 172px)`
                : `calc(${hs.position.y}% + 28px)`,
              background: 'rgba(15,23,42,0.96)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08)',
              animation: 'hs-preview-in 150ms ease forwards',
            }}
          >
            <style>{`
              @keyframes hs-preview-in {
                from { opacity: 0; transform: translateY(6px); }
                to   { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div className="aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-violet-500/50 to-fuchsia-600/40">
              {preview.thumbnail ? (
                <img
                  src={preview.thumbnail}
                  alt={preview.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-black leading-snug">{preview.name}</p>
              <p className="mt-0.5 text-[11px] text-white/45">{assetLabel}</p>
            </div>
          </div>
        );
      })()}

      {asset.hotspots.map((hotspot) => {
        const dotColor  = getHotspotDotColor(hotspot.type, primaryColor);
        const glow      = getHotspotGlow(hotspot.type, primaryColor);
        const hasPulse  = hotspot.type !== 'measurement';
        const isNavPreview = hotspot.type === 'navigation' && !!hotspot.targetSpaceId && !!spacePreviewMap;
        const label     = hotspot.type === 'navigation'
          ? `${hotspot.label} ›`
          : hotspot.label;

        return (
          <button
            key={hotspot.id}
            type="button"
            onClick={() => {
              if (longPressWas.current) { longPressWas.current = false; return; }
              handleHotspotClick(hotspot);
            }}
            onMouseEnter={() => { if (isNavPreview) setPreviewHotspotId(hotspot.id); }}
            onMouseLeave={() => { if (isNavPreview) setPreviewHotspotId(null); }}
            onTouchStart={() => {
              if (!isNavPreview) return;
              longPressWas.current = false;
              longPressTimer.current = setTimeout(() => {
                longPressWas.current = true;
                setPreviewHotspotId(hotspot.id);
              }, 350);
            }}
            onTouchEnd={() => {
              if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
              if (longPressWas.current) setTimeout(() => setPreviewHotspotId(null), 1800);
            }}
            onTouchMove={() => {
              if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
            }}
            className="group absolute z-20 flex min-h-[44px] -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full py-2 pl-2 pr-4 text-xs font-black text-white transition-all duration-200 motion-safe:hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            style={{
              left: `${hotspot.position.x}%`,
              top: `${hotspot.position.y}%`,
              background: 'rgba(0,0,0,0.52)',
              backdropFilter: 'blur(10px)',
              boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.45), ${glow}`,
            }}
          >
            {/* Pulse ring + core dot */}
            <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
              {hasPulse ? (
                <span
                  className="hs-ring absolute inset-0 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
              ) : null}
              <span
                className="relative z-10 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
            </span>
            <span className="leading-none">{label}</span>
          </button>
        );
      })}

      <div className="absolute bottom-5 right-5 z-30 flex gap-2 rounded-2xl border border-white/10 bg-black/45 p-2 text-white backdrop-blur">
        {vrSupported ? (
          <button
            type="button"
            onClick={() => { void handleVrToggle(); }}
            title={vrActive ? 'Salir de modo VR' : 'Entrar en modo VR inmersivo'}
            className={`h-10 rounded-xl px-3 text-xs font-black transition hover:bg-white/20 ${
              vrActive ? 'bg-violet-500/80 text-white' : 'bg-white/10'
            }`}
          >
            {vrActive ? '⬤ VR' : 'VR'}
          </button>
        ) : null}
        {supportsGyro ? (
          <button
            type="button"
            onClick={() => { void handleGyroToggle(); }}
            disabled={gyroPermDenied}
            title={gyroPermDenied ? 'Permiso de giroscopio denegado' : gyroActive ? 'Desactivar giroscopio' : 'Activar giroscopio'}
            className={`h-10 rounded-xl px-3 text-xs font-black transition hover:bg-white/20 ${
              gyroActive ? 'bg-violet-500/80 text-white' : 'bg-white/10'
            } ${gyroPermDenied ? 'opacity-40' : ''}`}
          >
            {gyroActive ? '⬤ Giro' : 'Giro'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => handleZoom(6)}
          className="h-10 w-10 rounded-xl bg-white/10 text-lg font-black hover:bg-white/20"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="h-10 rounded-xl bg-white/10 px-4 text-xs font-black uppercase tracking-[0.18em] hover:bg-white/20"
        >
          Reiniciar
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-6)}
          className="h-10 w-10 rounded-xl bg-white/10 text-lg font-black hover:bg-white/20"
        >
          +
        </button>
      </div>

      <MeasurementOverlay
        active={measureMode}
        getPoint3D={(relX, relY, w, h) => engineRef.current?.getPoint3D(relX, relY, w, h) ?? null}
        scaleToMeters={3 / 500}
      />
    </div>
  );
}
