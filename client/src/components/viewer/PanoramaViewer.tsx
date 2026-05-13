import { useEffect, useRef, useState } from 'react';
import { PanoramaEngine360 } from '@/engines/PanoramaEngine360';
import MeasurementOverlay from '@/components/viewer/MeasurementOverlay';
import type { Hotspot, ViewerAsset, ViewerEvent } from '@/types/viewer';

interface PanoramaViewerProps {
  propertyId: string;
  spaceId: string;
  asset: ViewerAsset;
  primaryColor?: string;
  measureMode?: boolean;
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
      <text x="1024" y="540" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#a5f3fc">Panorama 360 demo seguro</text>
      <text x="1024" y="600" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#cbd5e1">Fallback runtime activo hasta subida real de assets</text>
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

export default function PanoramaViewer({
  propertyId,
  spaceId,
  asset,
  primaryColor = '#7C3AED',
  measureMode = false,
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

  useEffect(() => {
    analyticsRef.current = onAnalyticsEvent;
  }, [onAnalyticsEvent]);

  useEffect(() => {
    hotspotClickRef.current = onHotspotClick;
  }, [onHotspotClick]);

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

    engineRef.current?.setFov(currentState.fov + delta);

    const nextState = engineRef.current?.getViewState();

    if (!nextState) return;

    currentFovRef.current = nextState.fov;
    setCurrentFov(nextState.fov);

    analyticsRef.current(
      createViewerEvent('zoom', {
        spaceId,
        assetId: asset.id,
        data: {
          propertyId,
          fov: nextState.fov
        }
      })
    );
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
      <div ref={containerRef} className="absolute inset-0" />

      {!isReady && !errorMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-white">
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-bold backdrop-blur">
            Cargando panorama 360°...
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
            <p className="text-lg font-black">Fallback del visor</p>
            <p className="mt-3 text-sm leading-6 text-white/65">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      {asset.hotspots.map((hotspot) => (
        <button
          key={hotspot.id}
          type="button"
          onClick={() => handleHotspotClick(hotspot)}
          className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/30 bg-black/45 px-3 py-2 text-xs font-black text-white shadow-2xl ring-4 ring-white/10 backdrop-blur transition hover:scale-105"
          style={{
            left: `${hotspot.position.x}%`,
            top: `${hotspot.position.y}%`
          }}
        >
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          {hotspot.type === 'cta'
            ? 'CTA'
            : hotspot.type === 'measurement'
              ? 'Medir'
              : hotspot.type === 'navigation'
                ? 'Ir'
                : 'Info'}
        </button>
      ))}

      <div className="absolute bottom-5 right-5 z-30 flex gap-2 rounded-2xl border border-white/10 bg-black/45 p-2 text-white backdrop-blur">
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
          Reset
        </button>
        <button
          type="button"
          onClick={() => handleZoom(-6)}
          className="h-10 w-10 rounded-xl bg-white/10 text-lg font-black hover:bg-white/20"
        >
          +
        </button>
      </div>

      <div className="absolute left-5 top-5 z-30 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-xs font-black text-white/75 backdrop-blur">
        FOV {Math.round(currentFov)}°
      </div>

      <MeasurementOverlay
        active={measureMode}
        getPoint3D={(relX, relY, w, h) => engineRef.current?.getPoint3D(relX, relY, w, h) ?? null}
        scaleToMeters={3 / 500}
      />
    </div>
  );
}
