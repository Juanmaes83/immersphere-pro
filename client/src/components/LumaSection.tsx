import { useState } from 'react';
import { usePropertyStore } from '@/store/propertyStore';
import type { ImmersiveProperty } from '@/store/propertyStore';

interface Props {
  property: ImmersiveProperty;
  isAuthenticated: boolean;
}

// Detects if a property has any space with a LUMA_EMBED asset
function getLumaSpace(property: ImmersiveProperty): { spaceId: string; assetUrl: string } | null {
  for (const space of property.spaces ?? []) {
    const lumaAsset = space.assets?.find(
      (a) => a.type === 'luma_embed' || (a as { type: string }).type === 'LUMA_EMBED'
    );
    if (lumaAsset) return { spaceId: space.id, assetUrl: lumaAsset.url };
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
    // Basic validation: must be a lumalabs.ai URL or a UUID
    const isLumaUrl = trimmed.includes('lumalabs.ai') ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (!isLumaUrl) {
      setError('Introduce una URL de Luma AI (lumalabs.ai/capture/...) o un UUID de escena.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const space = await createSpace(property.id, {
        name: 'Tour Luma 3D',
        order: (property.spaces?.length ?? 0) + 1,
      });
      await createAsset(property.id, space.id, {
        type: 'luma_embed',
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
            {existing ? 'Cambiar escena' : '+ Añadir escena Luma'}
          </button>
        )}
      </div>

      {/* Admin input form */}
      {isAuthenticated && editing && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-1 text-xs font-bold text-slate-500">
            URL de Luma AI <span className="font-normal opacity-70">(lumalabs.ai/capture/... o UUID)</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              placeholder="https://lumalabs.ai/capture/abc123..."
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
            Consigue la URL en <a href="https://lumalabs.ai" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">lumalabs.ai</a> → captura → Compartir → "Embed link"
          </p>
        </div>
      )}

      {/* Luma embed viewer */}
      {existing && (
        <div className="overflow-hidden rounded-[1.6rem] ring-1 ring-slate-200 dark:ring-slate-700" style={{ height: 480 }}>
          <iframe
            src={toEmbedUrl(existing.assetUrl)}
            className="h-full w-full border-0"
            allow="autoplay; fullscreen; xr-spatial-tracking"
            title="Tour 3D Luma"
            loading="lazy"
          />
        </div>
      )}

      {/* Empty state for admin */}
      {!existing && isAuthenticated && !editing && (
        <div className="flex h-40 items-center justify-center rounded-[1.6rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <p className="text-sm font-bold text-slate-400">Sin escena Luma 3D</p>
            <p className="mt-1 text-xs text-slate-400">
              Captura con la app Luma AI y pega el enlace aquí
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
