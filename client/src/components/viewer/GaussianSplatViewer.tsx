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
  const [activeTab, setActiveTab] = useState<'upload' | 'editor'>('upload');

  const removedCount = removedZones.length;

  const formatLabel = useMemo(() => {
    const lower = runtimeLabel.toLowerCase();
    if (lower.endsWith('.sog')) return 'SOG';
    if (lower.endsWith('.ply')) return 'PLY';
    if (lower.endsWith('.splat')) return 'SPLAT';
    if (lower.endsWith('.spz')) return 'SPZ';
    if (lower.endsWith('.glb')) return 'GLB';
    const fmt = asset.format.toUpperCase();
    // Guard against stale image format labels on splat assets
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
        data: { propertyId, filename: file.name, size: file.size }
      })
    );
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileChange({ target: { files: event.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
    }
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
        data: { propertyId, x, y, radius: zone.radius }
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
        data: { propertyId, enabled: nextValue }
      })
    );
  }

  function resetEditor(): void {
    setRemovedZones([]);
    setClipEnabled(false);
    setEditorMode(false);
    rendererRef.current?.clearSdfEdits();
  }

  // ── Upload dropzone (reused in both sidebar and viewer error state) ────────
  function UploadZone({ compact = false }: { compact?: boolean }) {
    return (
      <label
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/20 bg-black/25 text-center transition hover:border-fuchsia-400/50 hover:bg-white/10 ${compact ? 'p-4' : 'p-6'}`}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={handleDrop}
      >
        <span className={compact ? 'text-xl' : 'text-3xl'}>📂</span>
        <span className="block text-sm font-black text-white">
          Subir .ply / .splat / .spz / .sog
        </span>
        <span className="text-xs text-white/40">Haz clic o arrastra el archivo aquí</span>
        <input
          type="file"
          accept={getAcceptedSplatFormats()}
          onChange={handleFileChange}
          className="sr-only"
        />
      </label>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-slate-950 text-white">
      <div className="flex flex-col lg:flex-row">

        {/* ══════════════════════════════════════════════════════
            VIEWER — siempre primero, siempre visible
            Mobile  : ancho completo, min 56vh
            Desktop : flex-1, min 600px
        ══════════════════════════════════════════════════════ */}
        <div className="relative order-1 min-h-[56vh] w-full overflow-hidden bg-slate-950 lg:min-h-[600px] lg:flex-1">
          {/* Canvas 3D */}
          <div ref={containerRef} className="absolute inset-0" />

          {/* Estado: cargando */}
          {!isReady && !errorMessage ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/90">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-6 py-4 text-sm font-bold backdrop-blur">
                Cargando Gaussian Splat con SparkJS…
              </div>
            </div>
          ) : null}

          {/* Estado: error / sin archivo → prompt de subida centrado y SIEMPRE visible */}
          {errorMessage ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950 p-4">
              <div className="w-full max-w-sm space-y-4 text-center">
                {/* Card info */}
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <p className="text-5xl">🫧</p>
                  <p className="mt-3 text-lg font-black">Sube tu Gaussian Splat</p>
                  <p className="mt-2 text-sm leading-6 text-white/60">
                    El archivo de demo no está disponible desde este dominio.
                    Sube tu propio{' '}
                    <span className="font-bold text-fuchsia-300">.splat</span> o{' '}
                    <span className="font-bold text-fuchsia-300">.spz</span> para verlo aquí.
                  </p>
                </div>
                {/* Upload zone */}
                <div className="rounded-3xl border border-dashed border-fuchsia-400/40 bg-fuchsia-500/10 p-5 backdrop-blur">
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
                    Subir archivo local
                  </p>
                  <UploadZone />
                  <p className="mt-3 text-xs text-white/40">
                    Captura con{' '}
                    <span className="text-white/70">Luma AI</span> ·{' '}
                    <span className="text-white/70">Polycam</span> ·{' '}
                    <span className="text-white/70">Postshot</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Overlay del editor (crosshair + zonas SDF) */}
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

          {/* Badge de formato — visible en esquina inferior izquierda */}
          {isReady && !errorMessage ? (
            <div className="absolute bottom-4 left-4 z-40 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-fuchsia-200">
                Gaussian Splat · SparkJS
              </p>
              <p className="mt-0.5 text-xl font-black">{formatLabel}</p>
              <p className="mt-0.5 text-[0.65rem] text-white/50">WASD + ratón para navegar</p>
            </div>
          ) : null}

          {/* Overlay de medición */}
          <MeasurementOverlay
            active={measureMode}
            getPoint3D={(relX, relY, w, h) => rendererRef.current?.getPoint3D(relX, relY, w, h) ?? null}
            scaleToMeters={1}
          />
        </div>

        {/* ══════════════════════════════════════════════════════
            PANEL DE CONTROLES
            Mobile  : debajo del visor, tab-switcher (Archivo / Editor)
            Desktop : sidebar fija 280px, scroll interno independiente
        ══════════════════════════════════════════════════════ */}
        <div className="order-2 w-full shrink-0 border-t border-white/10 bg-white/[0.04] lg:w-[280px] lg:overflow-y-auto lg:border-l lg:border-t-0">

          {/* ── Header desktop (oculto en mobile) ── */}
          <div className="hidden border-b border-white/10 px-5 py-4 lg:block">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
              Gaussian Splat Editor
            </p>
            <p className="mt-1 text-[0.68rem] leading-5 text-white/40">
              Previsualización, edición básica y conexión con SuperSplat
            </p>
          </div>

          {/* ── Tab bar mobile (oculto en desktop) ── */}
          <div className="flex border-b border-white/10 lg:hidden">
            <button
              type="button"
              onClick={() => { setActiveTab('upload'); }}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3.5 text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'upload'
                  ? 'border-b-2 border-fuchsia-400 text-fuchsia-300'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span>📂</span> Archivo
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('editor'); }}
              className={`flex flex-1 items-center justify-center gap-1.5 py-3.5 text-xs font-black uppercase tracking-wider transition-colors ${
                activeTab === 'editor'
                  ? 'border-b-2 border-fuchsia-400 text-fuchsia-300'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span>✏️</span> Editor
            </button>
          </div>

          {/* ── Sección ARCHIVO ─────────────────────────────────
              Mobile  : visible solo en tab 'upload'
              Desktop : siempre visible
          ─────────────────────────────────────────────────── */}
          <div className={`p-5 ${activeTab === 'upload' ? 'block' : 'hidden'} lg:block`}>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
                Asset local
              </p>
              <p className="mt-2 truncate text-sm font-bold text-white/80">{runtimeLabel}</p>
              <div className="mt-3">
                <UploadZone compact />
              </div>
            </div>
          </div>

          {/* ── Sección EDITOR ──────────────────────────────────
              Mobile  : visible solo en tab 'editor'
              Desktop : siempre visible (con mt-0 ya que upload de arriba tiene p-5)
          ─────────────────────────────────────────────────── */}
          <div className={`px-5 pb-6 ${activeTab === 'editor' ? 'block' : 'hidden'} lg:block lg:pt-0`}>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
                Editor básico
              </p>

              {!isReady && !errorMessage ? (
                <p className="mt-3 text-xs text-white/40">
                  Disponible cuando el splat termine de cargar.
                </p>
              ) : !isReady && errorMessage ? (
                <p className="mt-3 text-xs text-white/40">
                  Sube un archivo .splat local para activar el editor.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => { setEditorMode((current) => !current); }}
                    title={
                      editorMode
                        ? 'Haz clic en el splat para ocultar zonas. Clic de nuevo para salir.'
                        : 'Activa el modo de borrado por esferas SDF.'
                    }
                    className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: editorMode ? '#DC2626' : primaryColor }}
                  >
                    {editorMode ? 'Salir de selección' : 'Seleccionar gaussianas'}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleClip}
                    title="Muestra un plano de recorte visual sobre el splat."
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
                      onClick={() => { window.open('https://superspl.at/editor', '_blank', 'noopener,noreferrer'); }}
                      title="Abre SuperSplat para limpiar, recortar y optimizar el splat."
                      className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Editar en SuperSplat →
                    </button>

                    <button
                      type="button"
                      onClick={() => { window.open('https://superspl.at/scene/6a0c3ccf', '_blank', 'noopener,noreferrer'); }}
                      title="Abre la escena de ejemplo en SuperSplat."
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

              {/* Contador de zonas */}
              <div className="mt-4 rounded-2xl bg-black/25 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                  Zonas ocultadas
                </p>
                <p className="mt-1 text-2xl font-black">{removedCount}</p>
              </div>

              <p className="mt-4 text-xs leading-5 text-white/45">
                Editor experimental conectado a flujo SuperSplat. Las zonas eliminadas usan esferas SDF con opacidad 0 sobre el SplatMesh.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
