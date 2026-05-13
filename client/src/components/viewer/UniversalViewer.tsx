import { useEffect, useMemo, useRef, useState } from 'react';
import GaussianSplatViewer from '@/components/viewer/GaussianSplatViewer';
import LeadCaptureModal from '@/components/viewer/LeadCaptureModal';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';
import { AUTH_STORAGE_KEYS } from '@/services/api';
import type {
  Hotspot,
  Space,
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

interface TourStop { spaceId: string; hotspot: Hotspot }

function buildTourStops(spaces: Space[]): TourStop[] {
  const stops: TourStop[] = [];
  for (const space of sortSpaces(spaces)) {
    for (const asset of space.assets) {
      for (const hotspot of asset.hotspots ?? []) {
        stops.push({ spaceId: space.id, hotspot });
      }
    }
  }
  return stops;
}

export default function UniversalViewer({
  propertyId,
  spaces,
  initialSpaceId,
  primaryColor = '#7C3AED',
  className = '',
  onAnalyticsEvent
}: UniversalViewerProps): JSX.Element {
  const sortedSpaces = useMemo(() => sortSpaces(spaces), [spaces]);
  const firstSpaceId = sortedSpaces[0]?.id ?? '';
  const [activeSpaceId, setActiveSpaceId] = useState(initialSpaceId ?? firstSpaceId);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tourIndexRef = useRef(0);
  const tourStops = useMemo(() => buildTourStops(spaces), [spaces]);
  const viewerRef = useRef<HTMLElement>(null);
  const sessionId = useRef(`s-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const activeSpace = sortedSpaces.find((space) => space.id === activeSpaceId) ?? sortedSpaces[0];
  const activeAsset = selectPrimaryAsset(activeSpace);

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

  useEffect(() => {
    if (!isTourActive || tourStops.length === 0) return;

    const interval = setInterval(() => {
      tourIndexRef.current = (tourIndexRef.current + 1) % tourStops.length;
      const stop = tourStops[tourIndexRef.current];
      if (!stop) return;

      if (stop.spaceId !== activeSpaceId) {
        setActiveSpaceId(stop.spaceId);
      }
      setActiveHotspot(stop.hotspot);
    }, 4000);

    return () => clearInterval(interval);
  }, [isTourActive, tourStops, activeSpaceId]);

  useEffect(() => {
    function onFullscreenChange(): void {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  function toggleFullscreen(): void {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (viewerRef.current) {
      viewerRef.current.requestFullscreen().catch(() => {});
    }
  }

  function toggleTour(): void {
    if (isTourActive) {
      setIsTourActive(false);
      return;
    }
    tourIndexRef.current = -1;
    setIsTourActive(true);
  }

  function handleSpaceChange(spaceId: string): void {
    const nextSpace = sortedSpaces.find((space) => space.id === spaceId);
    if (!nextSpace) return;

    setIsTourActive(false);
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
    setIsTourActive(false);
    setActiveHotspot(hotspot);

    const event = createViewerEvent('hotspot_click', {
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      hotspotId: hotspot.id,
      data: { propertyId, hotspotLabel: hotspot.label }
    });
    onAnalyticsEvent(event);
    trackToBackend({
      propertyId,
      spaceId: activeSpace?.id,
      assetId: activeAsset?.id,
      type: 'hotspot_click',
      label: hotspot.label,
      sessionId: sessionId.current
    });

    if (hotspot.type === 'navigation' && hotspot.targetSpaceId) {
      handleSpaceChange(hotspot.targetSpaceId);
    }
  }

  function handleLeadCtaOpen(): void {
    if (!activeHotspot) return;
    setShowLeadModal(true);
  }

  function handleLeadSubmitted(): void {
    if (!activeHotspot || !activeSpace || !activeAsset) return;

    const event = createViewerEvent('cta_lead', {
      spaceId: activeSpace.id,
      assetId: activeAsset.id,
      hotspotId: activeHotspot.id,
      data: { propertyId, hotspotLabel: activeHotspot.label }
    });
    onAnalyticsEvent(event);
    trackToBackend({
      propertyId,
      spaceId: activeSpace.id,
      assetId: activeAsset.id,
      type: 'lead_cta',
      label: activeHotspot.label,
      sessionId: sessionId.current
    });
  }

  if (!activeSpace || !activeAsset) {
    return (
      <section className={`rounded-[1.6rem] bg-slate-950 p-6 text-white ${className}`}>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
          Visor universal
        </p>
        <h2 className="mt-3 text-3xl font-black">Sin estancias configuradas</h2>
        <p className="mt-3 text-white/60">
          Esta propiedad necesita al menos una estancia y un asset para activar el visor.
        </p>
      </section>
    );
  }

  return (
    <section ref={viewerRef} className={`overflow-hidden rounded-[1.6rem] bg-slate-950 text-white ${className} ${isFullscreen ? 'fixed inset-0 z-[9999] rounded-none' : ''}`}>
      {showLeadModal && activeHotspot ? (
        <LeadCaptureModal
          propertyId={propertyId}
          hotspotLabel={activeHotspot.label}
          primaryColor={primaryColor}
          onClose={() => setShowLeadModal(false)}
          onSubmitted={() => { handleLeadSubmitted(); }}
        />
      ) : null}
      <div className="flex flex-col gap-4 border-b border-white/10 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
            Visor universal · Fase 4
          </p>
          <h2 className="mt-2 text-3xl font-black">
            {activeAsset.type === 'panorama_360'
              ? 'Panorama 360° real'
              : activeAsset.type === 'gaussian_splat'
                ? 'Gaussian Splat real / editor básico'
                : 'Mesh reservado'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Selección por estancia, asset primario, hotspots contextuales y eventos de analytics.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {sortedSpaces.map((space) => (
            <button
              key={space.id}
              type="button"
              onClick={() => handleSpaceChange(space.id)}
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
          {tourStops.length > 1 ? (
            <button
              type="button"
              onClick={toggleTour}
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                isTourActive
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-white/10 text-white/70 hover:bg-white/15'
              }`}
            >
              {isTourActive ? '⏸ Pausar tour' : '▶ Tour guiado'}
            </button>
          ) : null}
          {document.fullscreenEnabled ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white/70 transition hover:bg-white/15"
            >
              {isFullscreen ? '⊠ Salir' : '⛶ Presentar'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="p-5">
          {activeAsset.type === 'panorama_360' ? (
            <PanoramaViewer
              propertyId={propertyId}
              spaceId={activeSpace.id}
              asset={activeAsset}
              primaryColor={primaryColor}
              onHotspotClick={handleHotspotClick}
              onAnalyticsEvent={onAnalyticsEvent}
            />
          ) : activeAsset.type === 'gaussian_splat' ? (
            <GaussianSplatViewer
              propertyId={propertyId}
              spaceId={activeSpace.id}
              asset={activeAsset}
              primaryColor={primaryColor}
              onAnalyticsEvent={onAnalyticsEvent}
            />
          ) : (
            <div className="relative min-h-[520px] overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-fuchsia-500/30 via-violet-800/25 to-slate-950">
              <div className="absolute inset-10 rounded-[2rem] border border-fuchsia-300/15 bg-[radial-gradient(circle_at_35%_35%,rgba(217,70,239,0.28),transparent_18%),radial-gradient(circle_at_65%_55%,rgba(34,211,238,0.18),transparent_20%),radial-gradient(circle_at_48%_72%,rgba(255,255,255,0.12),transparent_16%)] shadow-[0_0_90px_rgba(217,70,239,0.18)]" />
              <div className="absolute left-8 top-8 rounded-2xl border border-fuchsia-300/20 bg-black/35 px-4 py-3 text-sm font-black text-fuchsia-100 backdrop-blur">
                Mesh 3D se implementa en fase posterior
              </div>
            </div>
          )}
        </div>

        <aside className="border-t border-white/10 bg-white/[0.04] p-5 lg:border-l lg:border-t-0">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Estancia activa
            </p>
            <h3 className="mt-3 text-2xl font-black">{activeSpace.name}</h3>
            <p className="mt-2 text-sm text-white/55">
              Asset: {activeAsset.format.toUpperCase()} · {activeAsset.size} MB · order{' '}
              {activeSpace.order}
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Hotspot activo
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
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/55">
                Haz clic en un hotspot dentro del visor para abrir información contextual, medición
                estimada o CTA comercial.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
