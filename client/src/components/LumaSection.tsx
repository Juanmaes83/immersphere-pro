import { useRef, useState } from 'react';
import { api, unwrapApiResponse, getApiErrorMessage } from '@/services/api';
import { usePropertyStore } from '@/store/propertyStore';
import type { ImmersiveProperty } from '@/store/propertyStore';
import type { UploadAssetResponse } from '@/types/api';

interface Props {
  property: ImmersiveProperty;
  isAuthenticated: boolean;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type EmbedKind = 'luma' | 'supersplat';
type AdminMode = null | 'choose' | 'splat' | 'url';

interface ExistingEmbed {
  assetUrl: string;
  kind: EmbedKind;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Only detects EXTERNAL embed assets (luma_embed, supersplat_embed).
 * gaussian_splat assets are shown in the main UniversalViewer, not here.
 */
function getExistingEmbed(property: ImmersiveProperty): ExistingEmbed | null {
  for (const space of property.spaces ?? []) {
    const asset = space.assets?.find(
      (a) =>
        a.type === 'luma_embed' ||
        (a as { type: string }).type === 'LUMA_EMBED' ||
        a.type === 'supersplat_embed' ||
        (a as { type: string }).type === 'SUPERSPLAT_EMBED'
    );
    if (asset) {
      const kind: EmbedKind =
        asset.type === 'supersplat_embed' ||
        (asset as { type: string }).type === 'SUPERSPLAT_EMBED'
          ? 'supersplat'
          : 'luma';
      return { assetUrl: asset.url, kind };
    }
  }
  return null;
}

function toLumaEmbedUrl(url: string): string {
  const base = 'https://lumalabs.ai/embed/';
  if (url.startsWith(base)) return url;
  const match = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (match) return `${base}${match[0]}`;
  return url
    .replace('lumalabs.ai/capture/', 'lumalabs.ai/embed/')
    .replace('lumalabs.ai/scene/', 'lumalabs.ai/embed/');
}

function toSuperSplatEmbedUrl(url: string): string {
  const base = 'https://superspl.at/s?id=';
  if (url.startsWith(base)) return url;
  const sceneMatch = url.match(/superspl\.at\/scene\/([a-f0-9]+)/i);
  if (sceneMatch) return `${base}${sceneMatch[1]}`;
  if (/^[a-f0-9]{8}$/i.test(url.trim())) return `${base}${url.trim()}`;
  return url;
}

function detectEmbedKind(url: string): EmbedKind {
  return url.includes('superspl.at') || /^[a-f0-9]{8}$/i.test(url.trim())
    ? 'supersplat'
    : 'luma';
}

function isSplatFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'splat' || ext === 'ply';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LumaSection({ property, isAuthenticated }: Props): JSX.Element | null {
  const { createSpace, createAsset, fetchPropertyById } = usePropertyStore();

  const [adminMode, setAdminMode]     = useState<AdminMode>(null);
  const [urlInput,  setUrlInput]      = useState('');
  const [saving,    setSaving]        = useState(false);
  const [progress,  setProgress]      = useState(0);
  const [error,     setError]         = useState('');
  const [splatSuccess, setSplatSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const existing = getExistingEmbed(property);

  function resetForm() {
    setAdminMode(null);
    setUrlInput('');
    setError('');
    setProgress(0);
  }

  // ── Option A: upload .splat/.ply → gaussian_splat (native, final) ──────────

  async function handleSplatUpload(file: File): Promise<void> {
    if (!isSplatFile(file)) {
      setError('Solo se aceptan archivos .splat o .ply.');
      return;
    }
    setSaving(true);
    setError('');
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const upload = await unwrapApiResponse<UploadAssetResponse>(
        api.post('/uploads', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (ev) => {
            const pct = ev.total ? Math.round((ev.loaded / ev.total) * 95) : 0;
            setProgress(Math.max(5, pct));
          }
        })
      );

      setProgress(97);

      const fmt = (upload.format || file.name.split('.').pop() || 'splat').toLowerCase() as 'splat' | 'ply';
      const space = await createSpace(property.id, {
        name: 'Gaussian Splat 3D',
        order: (property.spaces?.length ?? 0) + 1,
      });
      await createAsset(property.id, space.id, {
        type: 'gaussian_splat',
        url: upload.url,
        thumbnail: upload.thumbnailUrl || '',
        format: fmt,
        size: Math.round((upload.bytes || upload.size || file.size) / (1024 * 1024)),
        hotspots: [],
      });

      setProgress(100);
      await fetchPropertyById(property.id);
      setSplatSuccess(true);
      setAdminMode(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Option B: paste SuperSplat URL → supersplat_embed (temporary demo) ─────

  async function handleUrlSave(): Promise<void> {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const isLuma = trimmed.includes('lumalabs.ai') ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    const isSuperSplat = trimmed.includes('superspl.at') || /^[a-f0-9]{8}$/i.test(trimmed);

    if (!isLuma && !isSuperSplat) {
      setError('Introduce una URL de SuperSplat (superspl.at/scene/...) o Luma AI (lumalabs.ai/capture/...).');
      return;
    }

    const kind = detectEmbedKind(trimmed);
    setSaving(true);
    setError('');
    try {
      const space = await createSpace(property.id, {
        name: kind === 'supersplat' ? 'Referencia SuperSplat (temporal)' : 'Tour Luma 3D',
        order: (property.spaces?.length ?? 0) + 1,
      });
      await createAsset(property.id, space.id, {
        type: kind === 'supersplat' ? 'supersplat_embed' : 'luma_embed',
        url: trimmed,
        format: 'iframe',
        size: 0,
      });
      await fetchPropertyById(property.id);
      resetForm();
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render guard ──────────────────────────────────────────────────────────

  if (!existing && !isAuthenticated) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="mt-8">

      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          Tour 3D Interactivo
        </h3>
        {isAuthenticated && adminMode === null && (
          <button
            type="button"
            onClick={() => { setSplatSuccess(false); setAdminMode('choose'); }}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            {existing ? 'Cambiar escena' : '+ Añadir escena 3D'}
          </button>
        )}
      </div>

      {/* ── Admin: gaussian upload success notice ──────────────────────────── */}
      {splatSuccess && isAuthenticated && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <span className="mt-0.5 text-lg">✅</span>
          <div>
            <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">
              Gaussian interno añadido
            </p>
            <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400">
              El archivo .splat/.ply se ha subido a Cloudinary y aparece como nueva sala en el viewer principal (arriba). Es una escena 100% Immersphere, sin iframe ni SuperSplat.
            </p>
          </div>
        </div>
      )}

      {/* ── Admin: supersplat_embed warning (only when showing temporal demo) */}
      {existing?.kind === 'supersplat' && isAuthenticated && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <span className="mt-0.5 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-black text-amber-800 dark:text-amber-300">
              Referencia externa temporal (demo)
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              Esta escena se renderiza desde SuperSplat vía iframe. No es un Gaussian nativo de Immersphere.
              Para producción final: exporta <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.splat</code> o <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.ply</code> desde SuperSplat y súbelo como Gaussian interno.
            </p>
          </div>
        </div>
      )}

      {/* ── Admin: choose mode ─────────────────────────────────────────────── */}
      {isAuthenticated && adminMode === 'choose' && (
        <div className="mb-4 space-y-3">

          {/* Option A — Primary: Gaussian interno */}
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wide">
                Recomendado · Producción final
              </span>
            </div>
            <p className="text-sm font-black text-blue-900 dark:text-blue-200">
              Subir Gaussian interno (.splat / .ply)
            </p>
            <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-400">
              El archivo se sube a Cloudinary y se renderiza nativamente en Immersphere con SparkJS. Sin iframe, sin SuperSplat.
            </p>
            <button
              type="button"
              onClick={() => setAdminMode('splat')}
              className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 transition"
            >
              Seleccionar archivo .splat / .ply →
            </button>
          </div>

          {/* Option B — Secondary: demo externa */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex rounded-full bg-slate-400 px-2 py-0.5 text-[10px] font-black text-white uppercase tracking-wide">
                Solo demo · Referencia temporal
              </span>
            </div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-300">
              Pegar URL de SuperSplat (iframe externo)
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Incrusta la escena desde superspl.at vía iframe. Útil como referencia de demo mientras se prepara el archivo final.
            </p>
            <button
              type="button"
              onClick={() => setAdminMode('url')}
              className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-600 hover:bg-slate-100 transition dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Pegar URL SuperSplat →
            </button>
          </div>

          <button
            type="button"
            onClick={resetForm}
            className="text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Admin: .splat/.ply file upload ─────────────────────────────────── */}
      {isAuthenticated && adminMode === 'splat' && (
        <div className="mb-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="mb-1 text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-wide">
            Gaussian interno — producción final
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Exporta el archivo <strong>.splat</strong> o <strong>.ply</strong> desde SuperSplat y arrástralo aquí. Límite: 500 MB.
          </p>

          {/* File drop zone */}
          <div
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-300 bg-white p-6 cursor-pointer hover:border-blue-500 transition dark:border-blue-700 dark:bg-slate-900"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void handleSplatUpload(file);
            }}
          >
            <svg className="h-8 w-8 text-blue-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-black text-blue-700 dark:text-blue-300">
              Arrastra .splat o .ply aquí
            </p>
            <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".splat,.ply"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleSplatUpload(file);
              }}
            />
          </div>

          {/* Upload progress */}
          {saving && (
            <div className="mt-3">
              <div className="flex justify-between text-xs font-semibold text-blue-600 mb-1">
                <span>Subiendo a Cloudinary…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-blue-100">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="mt-2 text-xs font-semibold text-red-500">{error}</p>}

          {/* Pasos para exportar */}
          <div className="mt-4 rounded-xl bg-white/60 p-3 dark:bg-slate-800/60">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
              Cómo exportar desde SuperSplat:
            </p>
            <ol className="space-y-1">
              {[
                'Abre superspl.at/scene/91c1e47e',
                'Menú "⋯" → Export → .splat (más ligero) o .ply',
                'Arrastra el archivo aquí',
                'El Gaussian aparecerá en el viewer principal como sala nativa'
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                  <span className="shrink-0 rounded-full bg-blue-600 text-white w-4 h-4 flex items-center justify-center text-[10px] font-black mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={() => setAdminMode('choose')}
            disabled={saving}
            className="mt-3 text-xs font-bold text-slate-400 hover:text-slate-600 disabled:opacity-40"
          >
            ← Volver
          </button>
        </div>
      )}

      {/* ── Admin: SuperSplat URL input (temporal demo) ─────────────────────── */}
      {isAuthenticated && adminMode === 'url' && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-1 text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wide">
            Demo externa temporal
          </p>
          <p className="mb-3 text-xs text-slate-500">
            Esta escena se mostrará vía iframe de SuperSplat. <strong>No es un Gaussian nativo.</strong>{' '}
            Reemplázala con el archivo .splat/.ply cuando esté disponible.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => { setUrlInput(e.target.value); setError(''); }}
              placeholder="https://superspl.at/scene/91c1e47e"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-amber-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleUrlSave()}
              disabled={saving || !urlInput.trim()}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {saving ? '…' : 'Guardar'}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs font-semibold text-red-500">{error}</p>}
          <button
            type="button"
            onClick={() => setAdminMode('choose')}
            className="mt-2 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            ← Volver
          </button>
        </div>
      )}

      {/* ── External embed viewer (luma or supersplat) ─────────────────────── */}
      {existing && adminMode === null && (
        <div
          className="overflow-hidden rounded-[1.6rem] ring-1 ring-slate-200 dark:ring-slate-700"
          style={{ height: 480 }}
        >
          <iframe
            src={
              existing.kind === 'supersplat'
                ? toSuperSplatEmbedUrl(existing.assetUrl)
                : toLumaEmbedUrl(existing.assetUrl)
            }
            className="h-full w-full border-0"
            allow={
              existing.kind === 'supersplat'
                ? 'fullscreen; xr-spatial-tracking'
                : 'autoplay; fullscreen; xr-spatial-tracking'
            }
            title={existing.kind === 'supersplat' ? 'Referencia Gaussian Splat' : 'Tour 3D Luma'}
            loading="lazy"
          />
        </div>
      )}

      {/* ── Empty state for admin (no embed yet) ───────────────────────────── */}
      {!existing && !splatSuccess && isAuthenticated && adminMode === null && (
        <div className="flex h-40 items-center justify-center rounded-[1.6rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-sm font-bold text-slate-400">Sin escena 3D externa</p>
            <p className="mt-1 text-xs text-slate-400">
              Sube un Gaussian interno (.splat/.ply) o añade una referencia SuperSplat
            </p>
          </div>
        </div>
      )}

    </section>
  );
}
