import { useEffect, useRef, useState } from 'react';
import { PanoramaEngine360 } from '@/engines/PanoramaEngine360';
import type { Hotspot, ViewerAsset, ViewerEvent } from '@/types/viewer';

interface PanoramaViewerProps {
  propertyId: string;
  spaceId: string;
  asset: ViewerAsset;
  primaryColor?: string;
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

export default function PanoramaViewer({
  propertyId,
  spaceId,
  asset,
  primaryColor = '#7C3AED',
  onHotspotClick,
  onAnalyticsEvent
}: PanoramaViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PanoramaEngine360 | null>(null);
  const currentFovRef = useRef(75);
  const analyticsRef = useRef(onAnalyticsEvent);
  const hotspotClickRef = useRef(onHotspotClick);

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
        imageUrl: asset.url,
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
      void engine.load();

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
  }, [asset.id, asset.type, asset.url, propertyId, spaceId]);

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
    </div>
  );
}
