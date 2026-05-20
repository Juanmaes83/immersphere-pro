import { useState } from 'react';
import { usePropertyStore } from '@/store/propertyStore';
import type { ImmersiveProperty } from '@/store/propertyStore';

interface Props {
  property: ImmersiveProperty;
  isAuthenticated: boolean;
}

type EmbedKind = 'luma' | 'supersplat';

function detectEmbedKind(url: string): EmbedKind {
  return url.includes('superspl.at') || /^[a-f0-9]{8}$/i.test(url.trim())
    ? 'supersplat'
    : 'luma';
}

// Detects if a property has any space with a LUMA_EMBED or SUPERSPLAT_EMBED asset
function getLumaSpace(property: ImmersiveProperty): { spaceId: string; assetUrl: string; kind: EmbedKind } | null {
  for (const space of property.spaces ?? []) {
    const embedAsset = space.assets?.find(
      (a) =>
        a.type === 'luma_embed' ||
        (a as { type: string }).type === 'LUMA_EMBED' ||
        a.type === 'supersplat_embed' ||
        (a as { type: string }).type === 'SUPERSPLAT_EMBED'
    );
    if (embedAsset) {
      const kind: EmbedKind =
        embedAsset.type === 'supersplat_embed' || (embedAsset as { type: string }).type === 'SUPERSPLAT_EMBED'
          ? 'supersplat'
          : 'luma';
      return { spaceId: space.id, assetUrl: embedAsset.url, kind };
    }
  }
  return null;
}

function toEmbedUrl(url: string): string {
  const lumaBase = 'https://lumalabs.ai/embed/';
  if (url.startsWith(lumaBase)) return url;
  const match = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (match) return `${lumaBase}${match[0]}`;
  return url
    .replace('lumalabs.ai/capture/', 'lumalabs.ai/embed/')
    .replace('lumalabs.ai/scene/', 'lumalabs.ai/embed/');
}

function toSuperSplatEmbedUrl(url: string): string {
  const embedBase = 'https://superspl.at/s?id=';
  if (url.startsWith(embedBase)) return url;
  const sceneMatch = url.match(/superspl\.at\/scene\/([a-f0-9]+)/i);
  if (sceneMatch) return `${embedBase}${sceneMatch[1]}`;
  if (/^[a-f0-9]{8}$/i.test(url.trim())) return `${embedBase}${url.trim()}`;
  return url;
}

export default function LumaSection({ property, isAuthenticated }: Props): JSX.Element | null {
  const { createSpace, createAsset, fetchPropertyById } = usePropertyStore();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const existing = getLumaSpace(property);

  async function handleSave() {
    const trimmed = url.trim();
    if (!trimmed) return;
    // Accept Luma AI URLs/UUIDs and SuperSplat URLs/scene IDs
    const isLumaUrl = trimmed.includes('lumalabs.ai') ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    const isSuperSplatUrl = trimmed.includes('superspl.at') ||
      /^[a-f0-9]{8}$/i.test(trimmed);
    if (!isLumaUrl && !isSuperSplatUrl) {
      setError('Introduce una URL de Luma AI (lumalabs.ai/capture/...) o SuperSplat (superspl.at/scene/...).');
      return;
    }
    const kind = detectEmbedKind(trimmed);
    setSaving(true);
    setError('');
    try {
      const space = await createSpace(property.id, {
        name: kind === 'supersplat' ? 'Gaussian Splat 3D' : 'Tour Luma 3D',
        order: (property.spaces?.length ?? 0) + 1,
      });
      await createAsset(property.id, space.id, {
        type: kind === 'supersplat' ? 'supersplat_embed' : 'luma_embed',
        url: trimmed,
        format: 'iframe',
        size: 0,
      });
      await fetchPropertyById(property.id);
      setEditing(false);
      setUrl('');
    } catch {
      setError('Error al guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // If no Luma scene and not admin: don't show anything
  if (!existing && !isAuthenticated) return null;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">
          Tour 3D Interactivo
        </h3>
        {isAuthenticated && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            {existing ? 'Cambiar escena' : '+ Añadir escena 3D'}
          </button>
        )}
      </div>

      {/* Admin input form */}
      {isAuthenticated && editing && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-1 text-xs font-bold text-slate-500">
            URL de Luma AI o SuperSplat <span className="font-normal opacity-70">(lumalabs.ai/capture/... · superspl.at/scene/...)</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              placeholder="https://superspl.at/scene/91c1e47e"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              autoFocus
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !url.trim()}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? '…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(''); setUrl(''); }}
              className="rounded-xl px-3 py-2 text-sm font-black text-slate-400 hover:text-slate-600"
            >✕</button>
          </div>
          {error && <p className="mt-1.5 text-xs font-semibold text-red-500">{error}</p>}
          <p className="mt-2 text-xs text-slate-400">
            Luma: <a href="https://lumalabs.ai" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">lumalabs.ai</a> → captura → Compartir → "Embed link" ·{' '}
            SuperSplat: <a href="https://superspl.at" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">superspl.at</a> → escena → copiar URL
          </p>
        </div>
      )}

      {/* Embed viewer — Luma or SuperSplat */}
      {existing && (
        <div className="overflow-hidden rounded-[1.6rem] ring-1 ring-slate-200 dark:ring-slate-700" style={{ height: 480 }}>
          <iframe
            src={existing.kind === 'supersplat' ? toSuperSplatEmbedUrl(existing.assetUrl) : toEmbedUrl(existing.assetUrl)}
            className="h-full w-full border-0"
            allow={existing.kind === 'supersplat' ? 'fullscreen; xr-spatial-tracking' : 'autoplay; fullscreen; xr-spatial-tracking'}
            title={existing.kind === 'supersplat' ? 'Gaussian Splat 3D' : 'Tour 3D Luma'}
            loading="lazy"
          />
        </div>
      )}

      {/* Empty state for admin */}
      {!existing && isAuthenticated && !editing && (
        <div className="flex h-40 items-center justify-center rounded-[1.6rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-sm font-bold text-slate-400">Sin escena 3D</p>
            <p className="mt-1 text-xs text-slate-400">
              Añade una escena Luma AI o SuperSplat
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
