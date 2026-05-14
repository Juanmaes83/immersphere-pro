import { useEffect, useMemo, useRef, useState } from 'react';
import { GaussianSplatRenderer } from '@/engines/GaussianSplatRenderer';
import MeasurementOverlay from '@/components/viewer/MeasurementOverlay';
import type { RemovedSplatZone, ViewerAsset, ViewerEvent } from '@/types/viewer';

interface GaussianSplatViewerProps {
  propertyId: string;
  spaceId: string;
  asset: ViewerAsset;
  primaryColor?: string;
  measureMode?: boolean;
  onAnalyticsEvent: (event: ViewerEvent) => void;
}

function createViewerEvent(
  type: ViewerEvent['type'],
  data: {
    spaceId?: string;
    assetId?: string;
    data?: Record<string, unknown>;
  }
): ViewerEvent {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: Date.now(),
    spaceId: data.spaceId,
    assetId: data.assetId,
    data: data.data
  };
}

function getAcceptedSplatFormats(): string {
  return '.ply,.splat,.sog,.json,.glb';
}

export default function GaussianSplatViewer({
  propertyId,
  spaceId,
  asset,
  primaryColor = '#7C3AED',
  measureMode = false,
  onAnalyticsEvent
}: GaussianSplatViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GaussianSplatRenderer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const analyticsRef = useRef(onAnalyticsEvent);

  const [runtimeUrl, setRuntimeUrl] = useState(asset.url);
  const [runtimeLabel, setRuntimeLabel] = useState(asset.url.split('/').pop() ?? asset.format);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState(false);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [removedZones, setRemovedZones] = useState<RemovedSplatZone[]>([]);

  const removedCount = removedZones.length;

  const formatLabel = useMemo(() => {
    const lower = runtimeLabel.toLowerCase();
    if (lower.endsWith('.sog')) return 'SOG';
    if (lower.endsWith('.ply')) return 'PLY';
    if (lower.endsWith('.splat')) return 'SPLAT';
    return asset.format.toUpperCase();
  }, [asset.format, runtimeLabel]);

  useEffect(() => {
    analyticsRef.current = onAnalyticsEvent;
  }, [onAnalyticsEvent]);

  useEffect(() => {
    setRuntimeUrl(asset.url);
    setRuntimeLabel(asset.url.split('/').pop() ?? asset.format);
  }, [asset.format, asset.url]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    setIsReady(false);
    setErrorMessage(null);

    try {
      const renderer = new GaussianSplatRenderer({
        container,
        assetUrl: runtimeUrl,
        onReady: () => {
          setIsReady(true);
          setErrorMessage(null);
          analyticsRef.current(
            createViewerEvent('splat_ready', {
              spaceId,
              assetId: asset.id,
              data: { propertyId, runtimeUrl }
            })
          );
        },
        onError: (error) => {
          setIsReady(false);
          setErrorMessage(error.message);
          analyticsRef.current(
            createViewerEvent('splat_error', {
              spaceId,
              assetId: asset.id,
              data: { propertyId, message: error.message, runtimeUrl }
            })
          );
        }
      });

      rendererRef.current = renderer;
      void renderer.load(runtimeUrl);

      const handleResize = (): void => renderer.resize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        rendererRef.current = null;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo inicializar PlayCanvas.';
      setIsReady(false);
      setErrorMessage(message);
    }
  }, [asset.id, propertyId, runtimeUrl, spaceId]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.ply', '.splat', '.sog', '.json', '.glb'];
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension));

    if (!isAllowed) {
      setErrorMessage('Formato no soportado. Usa .ply, .splat, .sog, .json o .glb.');
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setRuntimeUrl(objectUrl);
    setRuntimeLabel(file.name);
    setRemovedZones([]);
    setErrorMessage(null);

    analyticsRef.current(
      createViewerEvent('asset_upload', {
        spaceId,
        assetId: asset.id,
        data: {
          propertyId,
          filename: file.name,
          size: file.size
        }
      })
    );
  }

  function handleEditorClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!editorMode) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const zone: RemovedSplatZone = {
      id: `removed-zone-${Date.now()}`,
      x,
      y,
      radius: 9,
      createdAt: Date.now()
    };

    setRemovedZones((current) => [...current, zone]);
    rendererRef.current?.addSdfSphere(x, y);

    analyticsRef.current(
      createViewerEvent('splat_editor_remove', {
        spaceId,
        assetId: asset.id,
        data: {
          propertyId,
          x,
          y,
          radius: zone.radius
        }
      })
    );
  }

  function handleToggleClip(): void {
    const nextValue = !clipEnabled;
    setClipEnabled(nextValue);
    analyticsRef.current(
      createViewerEvent('splat_editor_clip', {
        spaceId,
        assetId: asset.id,
        data: {
          propertyId,
          enabled: nextValue
        }
      })
    );
  }

  function resetEditor(): void {
    setRemovedZones([]);
    setClipEnabled(false);
    setEditorMode(false);
    rendererRef.current?.clearSdfEdits();
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-slate-950">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="relative min-h-[520px] overflow-hidden bg-slate-950">
          <div ref={containerRef} className="absolute inset-0" />

          {!isReady && !errorMessage ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 text-white">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-bold backdrop-blur">
                Cargando Gaussian Splat con SparkJS...
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-fuchsia-500/25 via-violet-900/35 to-slate-950 p-6 text-center text-white">
              <div className="max-w-lg rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur">
                <p className="text-xl font-black">Splat no disponible</p>
                <p className="mt-3 text-sm leading-6 text-white/65">{errorMessage}</p>
                <p className="mt-4 text-xs leading-5 text-white/45">
                  El visor SparkJS está activo. Si el asset no es un splat válido, la experiencia se mantiene estable y el error queda registrado.
                </p>
              </div>
            </div>
          ) : null}

          <div
            role="presentation"
            onClick={handleEditorClick}
            className={`absolute inset-0 z-30 ${editorMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
          >
            {clipEnabled ? (
              <div className="absolute inset-y-10 left-10 right-10 rounded-[2rem] border-2 border-dashed border-cyan-300/50 bg-cyan-300/5" />
            ) : null}
            {removedZones.map((zone) => (
              <div
                key={zone.id}
                className="absolute rounded-full border border-red-300/70 bg-red-500/25 shadow-[0_0_30px_rgba(248,113,113,0.35)]"
                style={{
                  left: `${zone.x}%`,
                  top: `${zone.y}%`,
                  width: `${zone.radius * 2}%`,
                  height: `${zone.radius * 2}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            ))}
          </div>

          <div className="absolute bottom-5 left-5 z-40 rounded-2xl border border-white/10 bg-black/45 p-4 text-white backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Gaussian Splat · SparkJS</p>
            <p className="mt-1 text-2xl font-black">{formatLabel}</p>
            <p className="mt-1 text-xs text-white/50">WASD + ratón para navegar</p>
          </div>

          <MeasurementOverlay
            active={measureMode}
            getPoint3D={(relX, relY, w, h) => rendererRef.current?.getPoint3D(relX, relY, w, h) ?? null}
            scaleToMeters={1}
          />
        </div>

        <aside className="border-t border-white/10 bg-white/[0.04] p-5 text-white lg:border-l lg:border-t-0">
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Asset local</p>
            <p className="mt-2 truncate text-sm font-bold text-white/80">{runtimeLabel}</p>
            <label className="mt-4 block rounded-2xl border border-dashed border-white/20 bg-black/25 p-4 text-sm text-white/70">
              <span className="block font-black text-white">Subir .ply / .splat / .sog</span>
              <input
                type="file"
                accept={getAcceptedSplatFormats()}
                onChange={handleFileChange}
                className="mt-3 w-full text-xs"
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Editor básico</p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setEditorMode((current) => !current)}
                className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: editorMode ? '#DC2626' : primaryColor }}
              >
                {editorMode ? 'Salir de selección' : 'Seleccionar gaussianas'}
              </button>
              <button
                type="button"
                onClick={handleToggleClip}
                className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
              >
                {clipEnabled ? 'Desactivar clipping' : 'Activar plano de clipping'}
              </button>
              <button
                type="button"
                onClick={resetEditor}
                className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
              >
                Reset editor
              </button>

              {isReady ? (
                <div>
                  <button
                    type="button"
                    onClick={() => window.open('https://superspl.at/editor', '_blank', 'noopener,noreferrer')}
                    title="Abrir editor profesional para limpiar y optimizar"
                    className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Editar en SuperSplat →
                  </button>
                  <p className="mt-2 text-center text-xs text-white/40">
                    Guarda y vuelve a subir el resultado
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Zonas ocultadas</p>
              <p className="mt-1 text-2xl font-black">{removedCount}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/45">
              Editor SDF real con SparkJS. Las zonas eliminadas usan esferas SDF con opacidad 0 aplicadas directamente sobre el SplatMesh.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
