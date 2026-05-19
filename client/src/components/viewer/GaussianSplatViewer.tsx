import { useEffect, useMemo, useRef, useState } from 'react';
import { GaussianSplatRenderer } from '@/engines/GaussianSplatRenderer';
import MeasurementOverlay from '@/components/viewer/MeasurementOverlay';
import { t } from '@/i18n/dictionary';
import type { RemovedSplatZone, ViewerAsset, ViewerEvent } from '@/types/viewer';

// Future: extend to viewerMode: 'public' | 'admin' | 'embed' | 'kiosk'
interface GaussianSplatViewerProps {
  propertyId: string;
  spaceId: string;
  asset: ViewerAsset;
  primaryColor?: string;
  measureMode?: boolean;
  /** When false (default): shows only the immersive 3D canvas — no editor, no upload, no tech badges. */
  isAdminMode?: boolean;
  lang?: string;
  onAnalyticsEvent: (event: ViewerEvent) => void;
}

// Formats actually supported end-to-end (backend multer + SparkJS renderer).
// .spz / .sog / .json are NOT accepted by the backend — do not advertise them.
const ACCEPTED_FORMATS = '.ply,.splat';
const ALLOWED_EXTENSIONS = ['.ply', '.splat'];

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

export default function GaussianSplatViewer({
  propertyId,
  spaceId,
  asset,
  primaryColor = '#7C3AED',
  measureMode = false,
  isAdminMode = false,
  lang,
  onAnalyticsEvent
}: GaussianSplatViewerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<GaussianSplatRenderer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const analyticsRef = useRef(onAnalyticsEvent);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [runtimeUrl, setRuntimeUrl] = useState(asset.url);
  const [runtimeLabel, setRuntimeLabel] = useState(asset.url.split('/').pop() ?? asset.format);
  const [isReady, setIsReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slowLoading, setSlowLoading] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [removedZones, setRemovedZones] = useState<RemovedSplatZone[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'editor'>('upload');
  const [retryKey, setRetryKey] = useState(0);

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
    setSlowLoading(false);

    // Show a gentle "this is taking longer" message after 10 s
    slowTimerRef.current = setTimeout(() => {
      setSlowLoading(true);
    }, 10_000);

    try {
      const renderer = new GaussianSplatRenderer({
        container,
        assetUrl: runtimeUrl,
        onReady: () => {
          if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
          setSlowLoading(false);
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
          if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
          setSlowLoading(false);
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
        if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        rendererRef.current = null;
      };
    } catch (error) {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      const message = error instanceof Error ? error.message : 'Renderer init failed.';
      setSlowLoading(false);
      setIsReady(false);
      setErrorMessage(message);
    }
  }, [asset.id, propertyId, runtimeUrl, spaceId, retryKey]);

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

    const lowerName = file.name.toLowerCase();
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!isAllowed) {
      setErrorMessage(t(lang, 'splat_format_error'));
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
          {t(lang, 'splat_upload_cta')}
        </span>
        <span className="text-xs text-white/40">{t(lang, 'splat_upload_hint')}</span>
        <input
          type="file"
          accept={ACCEPTED_FORMATS}
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
              <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/10 px-6 py-5 text-center backdrop-blur">
                <div
                  className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/10"
                  style={{ borderTopColor: primaryColor }}
                />
                <div>
                  <p className="text-sm font-bold text-white">
                    {t(lang, 'splat_loading')}
                  </p>
                  {slowLoading ? (
                    <p className="mt-1.5 text-xs text-white/45">
                      {t(lang, 'splat_loading_slow')}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {/* Estado: error */}
          {errorMessage ? (
            isAdminMode ? (
              /* ADMIN — upload zone + debug info */
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-violet-950 via-slate-950 to-slate-950 p-4">
                <div className="w-full max-w-sm space-y-4 text-center">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                    <p className="text-5xl">🫧</p>
                    <p className="mt-3 text-lg font-black">{t(lang, 'splat_admin_fallback_title')}</p>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      {t(lang, 'splat_admin_fallback_body')}
                    </p>
                    <p className="mt-2 text-xs text-white/30">{errorMessage}</p>
                  </div>
                  <div className="rounded-3xl border border-dashed border-fuchsia-400/40 bg-fuchsia-500/10 p-5 backdrop-blur">
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
                      {t(lang, 'splat_admin_upload_label')}
                    </p>
                    <UploadZone />
                    <p className="mt-3 text-xs text-white/40">
                      {t(lang, 'splat_capture_hint')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* PUBLIC — friendly fallback, no technical language, no upload */
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-6">
                <div className="w-full max-w-xs space-y-5 text-center">
                  <p className="text-5xl opacity-40">✦</p>
                  <div>
                    <p className="text-lg font-black text-white">
                      {t(lang, 'splat_unavailable')}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      {t(lang, 'splat_unavailable_body')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setRetryKey((k) => k + 1); }}
                    className="w-full rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {t(lang, 'splat_retry')}
                  </button>
                </div>
              </div>
            )
          ) : null}

          {/* Overlay del editor (crosshair + zonas SDF) */}
          <div
            role="presentation"
            onClick={handleEditorClick}
            className={`absolute inset-0 z-30 ${editorMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
          >
            {clipEnabled ? (
              <div className="absolute inset-y-10 left-10 right-10 rounded-[2rem] border-2 border-dashed border-violet-300/50 bg-violet-300/5" />
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

          {/* Badge de formato — solo en modo admin */}
          {isAdminMode && isReady && !errorMessage ? (
            <div className="absolute bottom-4 left-4 z-40 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-fuchsia-200">
                {t(lang, 'splat_admin_title')} · SparkJS
              </p>
              <p className="mt-0.5 text-xl font-black">{formatLabel}</p>
              <p className="mt-0.5 text-[0.65rem] text-white/50">{t(lang, 'splat_controls_hint')}</p>
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
            PANEL DE CONTROLES — solo visible en modo admin
        ══════════════════════════════════════════════════════ */}
        {isAdminMode ? <div className="order-2 w-full shrink-0 border-t border-white/10 bg-white/[0.04] lg:w-[280px] lg:overflow-y-auto lg:border-l lg:border-t-0">

          {/* ── Header desktop (oculto en mobile) ── */}
          <div className="hidden border-b border-white/10 px-5 py-4 lg:block">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
              {t(lang, 'splat_admin_title')}
            </p>
            <p className="mt-1 text-[0.68rem] leading-5 text-white/40">
              {t(lang, 'splat_admin_subtitle')}
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
              <span>📂</span> {t(lang, 'splat_tab_file')}
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
              <span>✏️</span> {t(lang, 'splat_tab_editor')}
            </button>
          </div>

          {/* ── Sección ARCHIVO ─────────────────────────────────
              Mobile  : visible solo en tab 'upload'
              Desktop : siempre visible
          ─────────────────────────────────────────────────── */}
          <div className={`p-5 ${activeTab === 'upload' ? 'block' : 'hidden'} lg:block`}>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
                {t(lang, 'splat_local_asset')}
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
                {t(lang, 'splat_basic_editor')}
              </p>

              {!isReady && !errorMessage ? (
                <p className="mt-3 text-xs text-white/40">
                  {t(lang, 'splat_editor_loading_hint')}
                </p>
              ) : !isReady && errorMessage ? (
                <p className="mt-3 text-xs text-white/40">
                  {t(lang, 'splat_editor_no_file_hint')}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => { setEditorMode((current) => !current); }}
                    title={
                      editorMode
                        ? t(lang, 'splat_exit_selection')
                        : t(lang, 'splat_select_gaussians')
                    }
                    className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    style={{ backgroundColor: editorMode ? '#DC2626' : primaryColor }}
                  >
                    {editorMode ? t(lang, 'splat_exit_selection') : t(lang, 'splat_select_gaussians')}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleClip}
                    title={clipEnabled ? t(lang, 'splat_disable_clip') : t(lang, 'splat_enable_clip')}
                    className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                  >
                    {clipEnabled ? t(lang, 'splat_disable_clip') : t(lang, 'splat_enable_clip')}
                  </button>

                  <button
                    type="button"
                    onClick={resetEditor}
                    title={t(lang, 'splat_reset')}
                    className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                  >
                    {t(lang, 'splat_reset')}
                  </button>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => { window.open('https://superspl.at/editor', '_blank', 'noopener,noreferrer'); }}
                      title={t(lang, 'splat_open_supersplat')}
                      className="w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {t(lang, 'splat_open_supersplat')}
                    </button>

                    <button
                      type="button"
                      onClick={() => { window.open('https://superspl.at/scene/6a0c3ccf', '_blank', 'noopener,noreferrer'); }}
                      title={t(lang, 'splat_preview_supersplat')}
                      className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white/80 transition hover:bg-white/10"
                    >
                      {t(lang, 'splat_preview_supersplat')}
                    </button>

                    <p className="text-center text-xs text-white/40">
                      {t(lang, 'splat_supersplat_note')}
                    </p>
                  </div>
                </div>
              )}

              {/* Contador de zonas */}
              <div className="mt-4 rounded-2xl bg-black/25 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">
                  {t(lang, 'splat_zones_label')}
                </p>
                <p className="mt-1 text-2xl font-black">{removedCount}</p>
              </div>

              <p className="mt-4 text-xs leading-5 text-white/45">
                {t(lang, 'splat_editor_note')}
              </p>
            </div>
          </div>

        </div> : null}
      </div>
    </div>
  );
}
