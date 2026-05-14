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
  return '.ply,.splat,.spz,.sog,.json,.glb';
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
    if (lower.endsWith('.spz')) return 'SPZ';
    if (lower.endsWith('.glb')) return 'GLB';
    const fmt = asset.format.toUpperCase();
    // Avoid showing image format labels on splat assets (stale DB metadata)
    return ['JPG', 'JPEG', 'PNG', 'WEBP', 'GIF'].includes(fmt) ? 'SPLAT' : fmt;
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

    const allowedExtensions = ['.ply', '.splat', '.spz', '.sog', '.json', '.glb'];
    const lowerName = file.name.toLowerCase();
    const isAllowed = allowedExtensions.some((extension) => lowerName.endsWith(extension));

    if (!isAllowed) {
      setErrorMessage('Formato no soportado. Usa .ply, .splat, .spz, .sog, .json o .glb.');
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
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">

        {/* ── LEFT: Controls ──────────────────────────────────────── */}
        <aside className="order-2 border-t border-white/10 bg-white/[0.04] p-5 text-white lg:order-1 lg:border-r lg:border-t-0">

          {/* Header */}
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Gaussian Splat Editor</p>
            <p className="mt-1 text-[0.7rem] leading-5 text-white/40">
              Previsualización, edición básica y conexión con SuperSplat
            </p>
          </div>

          {/* Asset local */}
          <div className="rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Asset local</p>
            <p className="mt-2 truncate text-sm font-bold text-white/80">{runtimeLabel}</p>
            <label
              className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/25 p-5 text-center transition hover:border-fuchsia-400/50 hover:bg-white/10"
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  handleFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
                }
              }}
            >
              <span className="text-2xl">📂</span>
              <span className="block text-sm font-black text-white">Subir .ply / .splat / .spz / .sog</span>
              <span className="text-xs text-white/40">Haz clic o arrastra el archivo aquí</span>
              <input
                type="file"
                accept={getAcceptedSplatFormats()}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          {/* Editor básico */}
          <div className="mt-5 rounded-2xl bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Editor básico</p>
            {!isReady && !errorMessage ? (
              <p className="mt-3 text-xs text-white/40">Disponible cuando el splat termine de cargar.</p>
            ) : !isReady && errorMessage ? (
              <p className="mt-3 text-xs text-white/40">Sube un archivo .splat local para activar el editor.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setEditorMode((current) => !current)}
                  title={editorMode ? 'Haz clic en el splat para ocultar zonas no deseadas. Clic de nuevo para salir.' : 'Activa el modo de borrado por esferas SDF. Haz clic sobre el splat para ocultar zonas.'}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                  style={{ backgroundColor: editorMode ? '#DC2626' : primaryColor }}
                >
                  {editorMode ? 'Salir de selección' : 'Seleccionar gaussianas'}
                </button>
                <button
                  type="button"
                  onClick={handleToggleClip}
                  title="Muestra un plano de recorte visual sobre el splat. Útil para ver secciones interiores."
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                >
                  {clipEnabled ? 'Desactivar clipping' : 'Activar plano de clipping'}
                </button>
                <button
                  type="button"
                  onClick={resetEditor}
                  title="Elimina todas las zonas ocultas y desactiva el plano de clipping."
                  className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                >
                  Reset editor
                </button>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => window.open('https://superspl.at/editor', '_blank', 'noopener,noreferrer')}
                    title="Abre SuperSplat, el editor profesional de PlayCanvas. Limpia, recorta y optimiza el splat, luego expórtalo y vuelve a subirlo aquí."
                    className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Editar en SuperSplat →
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open('https://superspl.at/scene/6a0c3ccf', '_blank', 'noopener,noreferrer')}
                    title="Abre la escena de ejemplo en SuperSplat para ver cómo se visualiza un tour 3D completo."
                    className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                  >
                    Previsualizar en SuperSplat →
                  </button>
                  <p className="text-center text-xs text-white/40">
                    Guarda y vuelve a subir el resultado
                  </p>
                </div>
              </div>
            )}
            <div className="mt-4 rounded-2xl bg-black/25 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Zonas ocultadas</p>
              <p className="mt-1 text-2xl font-black">{removedCount}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-white/45">
              Editor experimental conectado a flujo SuperSplat. Las zonas eliminadas usan esferas SDF con opacidad 0 sobre el SplatMesh.
            </p>
          </div>
        </aside>

        {/* ── RIGHT: Viewer ───────────────────────────────────────── */}
        <div className="relative order-1 min-h-[520px] overflow-hidden bg-slate-950 lg:order-2">
          <div ref={containerRef} className="absolute inset-0" />

          {!isReady && !errorMessage ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 text-white">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-bold backdrop-blur">
                Cargando Gaussian Splat con SparkJS...
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950 p-6 text-center text-white">
              <div className="max-w-md w-full space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <p className="text-4xl">🫧</p>
                  <p className="mt-3 text-lg font-black">Sube tu Gaussian Splat</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    El archivo de demo no está disponible desde este dominio. Sube tu propio{' '}
                    <span className="font-bold text-fuchsia-300">.splat</span> o{' '}
                    <span className="font-bold text-fuchsia-300">.spz</span> para verlo aquí.
                  </p>
                </div>
                <div className="rounded-3xl border border-dashed border-fuchsia-400/40 bg-fuchsia-500/10 p-5 backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Subir archivo local</p>
                  <label className="mt-3 block cursor-pointer rounded-2xl border border-white/20 bg-black/30 p-4 transition hover:bg-white/10">
                    <span className="block text-sm font-bold text-white">Seleccionar .ply / .splat / .spz / .sog</span>
                    <input
                      type="file"
                      accept={getAcceptedSplatFormats()}
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>
                  <p className="mt-3 text-xs text-white/40">
                    Captura con <span className="text-white/70">Luma AI</span> · <span className="text-white/70">Polycam</span> · <span className="text-white/70">Postshot</span> y exporta a .splat
                  </p>
                </div>
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

          {isReady && !errorMessage ? (
            <div className="absolute bottom-5 left-5 z-40 rounded-2xl border border-white/10 bg-black/45 p-4 text-white backdrop-blur">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Gaussian Splat · SparkJS</p>
              <p className="mt-1 text-2xl font-black">{formatLabel}</p>
              <p className="mt-1 text-xs text-white/50">WASD + ratón para navegar</p>
            </div>
          ) : null}

          <MeasurementOverlay
            active={measureMode}
            getPoint3D={(relX, relY, w, h) => rendererRef.current?.getPoint3D(relX, relY, w, h) ?? null}
            scaleToMeters={1}
          />
        </div>

      </div>
    </div>
  );
}
