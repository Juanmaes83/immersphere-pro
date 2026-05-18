import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '@/services/api';
import { useBrand } from '@/hooks/useBrand';
import { usePropertyStore, type ImmersiveProperty } from '@/store/propertyStore';
import type { PropertyStatItem } from '@/types/gallery';
import { formatCurrency } from '@/utils/format';

function PropertyCard({
  property,
  onOpen,
  hotBadge,
  compareMode,
  isSelectedForCompare,
  onToggleCompare
}: {
  property: ImmersiveProperty;
  onOpen: () => void;
  hotBadge?: boolean;
  compareMode?: boolean;
  isSelectedForCompare?: boolean;
  onToggleCompare?: (id: string) => void;
}): JSX.Element {
  const { bgStyle, colorStyle } = useBrand();
  const thumb = property.thumbnailUrl;
  return (
    <article className="overflow-hidden rounded-[1.7rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl dark:bg-slate-800 dark:ring-slate-700">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-violet-400/35 via-fuchsia-500/20 to-slate-950">
          {thumb ? (
            <img src={thumb} alt={property.title} className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black text-white opacity-60" style={bgStyle}>
                ✦
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/40">Sin imagen</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          {compareMode ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCompare?.(property.id); }}
              className={`absolute left-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 backdrop-blur transition ${
                isSelectedForCompare
                  ? 'border-violet-400 bg-violet-600 text-white'
                  : 'border-white/70 bg-black/40 text-white/50 hover:border-white hover:bg-black/60'
              }`}
            >
              {isSelectedForCompare ? '✓' : ''}
            </button>
          ) : hotBadge ? (
            <span className="absolute left-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">
              🔥 Más vistas
            </span>
          ) : null}
          {property.isPasswordProtected ? (
            <span className="absolute right-4 top-4 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
              🔒 Protegido
            </span>
          ) : null}
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h3 className="text-2xl font-black leading-tight">{property.title}</h3>
            <p className="mt-1 text-sm font-semibold text-white/75">{property.area} m² · {property.rooms} hab.</p>
          </div>
        </div>
      </button>
      <div className="p-5">
        <p className="text-xl font-black text-slate-950 dark:text-slate-100">{formatCurrency(property.price)}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{property.description}</p>
        {property.address ? <p className="mt-2 text-xs font-semibold" style={colorStyle}>📍 {property.address}</p> : null}
        <button type="button" onClick={onOpen} className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
          Abrir ficha inmersiva
        </button>
      </div>
    </article>
  );
}

export default function GalleryPage(): JSX.Element {
  const navigate = useNavigate();
  const { properties, fetchProperties, isLoading, error } = usePropertyStore();
  const [query, setQuery] = useState('');
  const [topIds, setTopIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  useEffect(() => {
    void fetchProperties({ status: 'PUBLISHED' });
    api.get('/properties/stats')
      .then((res) => {
        const items = (res.data as { data: PropertyStatItem[] }).data ?? [];
        setTopIds(new Set(items.filter((p) => p.views > 0).map((p) => p.id)));
      })
      .catch(() => {});
  }, [fetchProperties]);

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return properties;
    return properties.filter((property) => `${property.title} ${property.description}`.toLowerCase().includes(normalizedQuery));
  }, [properties, query]);

  function toggleCompareSelection(id: string): void {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const { colorStyle, bgStyle } = useBrand();

  return (
    <main className={`mx-auto max-w-7xl px-5 py-10 ${compareMode && selectedForCompare.length > 0 ? 'pb-28' : ''}`}>
      <Helmet>
        <title>Galería de propiedades · Immersphere Pro</title>
        <meta name="description" content="Explora propiedades con tours virtuales inmersivos en 360° y Gaussian Splats. Visita los espacios como si estuvieras allí." />
      </Helmet>
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Galería pública</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight">Propiedades publicadas</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar propiedad"
            className="brand-focus rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 md:w-72"
          />
          <button
            type="button"
            onClick={() => { setCompareMode((prev) => !prev); setSelectedForCompare([]); }}
            className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
              compareMode
                ? 'bg-violet-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
            }`}
          >
            {compareMode ? '✕ Cancelar' : '⊞ Comparar'}
          </button>
        </div>
      </div>

      {compareMode && (
        <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Selecciona 2 o 3 propiedades para comparar. {selectedForCompare.length}/3 seleccionadas.
        </p>
      )}

      {error ? <div className="mt-6 rounded-2xl bg-red-50 p-4 font-bold text-red-700">{error}</div> : null}
      {isLoading ? <p className="mt-8 font-bold text-slate-500 dark:text-slate-400">Cargando propiedades...</p> : null}

      {topIds.size > 0 && !query && !compareMode ? (
        <div className="mt-8">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-amber-600">🔥 Más vistas</p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.filter((p) => topIds.has(p.id)).slice(0, 3).map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onOpen={() => navigate(`/property/${property.id}`)}
                hotBadge
                compareMode={compareMode}
                isSelectedForCompare={selectedForCompare.includes(property.id)}
                onToggleCompare={toggleCompareSelection}
              />
            ))}
          </div>
          <p className="mt-8 mb-4 text-sm font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Todas las propiedades</p>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProperties.map((property) => (
          <PropertyCard
            key={property.id}
            property={property}
            onOpen={() => navigate(`/property/${property.id}`)}
            hotBadge={!compareMode && topIds.has(property.id)}
            compareMode={compareMode}
            isSelectedForCompare={selectedForCompare.includes(property.id)}
            onToggleCompare={toggleCompareSelection}
          />
        ))}
      </div>

      {/* Compare bottom bar */}
      {compareMode && selectedForCompare.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 py-4 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5">
            <p className="font-black dark:text-white">
              {selectedForCompare.length} propiedad{selectedForCompare.length !== 1 ? 'es' : ''} seleccionada{selectedForCompare.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/compare?ids=${selectedForCompare.join(',')}`)}
              disabled={selectedForCompare.length < 2}
              className="rounded-full px-6 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
              style={bgStyle}
            >
              Ver comparación →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
