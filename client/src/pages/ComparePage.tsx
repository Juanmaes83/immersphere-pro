import { lazy, Suspense, useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { api } from '@/services/api';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { CompareData } from '@/types/compare';
import { toCompareData } from '@/utils/compare';
import { formatCurrency } from '@/utils/format';

const PanoramaViewer = lazy(() => import('@/components/viewer/PanoramaViewer'));

function CompareColumn({ propertyId }: { propertyId: string }): JSX.Element {
  const navigate = useNavigate();
  const { bgStyle } = useBrand();
  const [data, setData] = useState<CompareData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    api.get(`/properties/${propertyId}`)
      .then((res) => {
        const raw = (res.data as { data: Record<string, unknown> }).data;
        setData(toCompareData(raw));
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, [propertyId]);

  async function handleUnlock(e: FormEvent): Promise<void> {
    e.preventDefault();
    setUnlocking(true);
    setPasswordError(null);
    try {
      const res = await api.post(`/properties/${propertyId}/unlock`, { password: passwordInput });
      const raw = (res.data as { data: Record<string, unknown> }).data;
      setData(toCompareData(raw));
    } catch {
      setPasswordError('Contraseña incorrecta.');
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-[1.7rem] bg-slate-100 dark:bg-slate-800" style={{ minHeight: '420px' }} />
    );
  }

  if (fetchError || !data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[1.7rem] bg-slate-100 p-6 text-center dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-400">Propiedad no encontrada.</p>
      </div>
    );
  }

  if (data.isPasswordProtected) {
    return (
      <div className="overflow-hidden rounded-[1.7rem] bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-slate-400 dark:text-slate-500" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div className="p-5">
          <h3 className="text-xl font-black dark:text-white">{data.title}</h3>
          <p className="mt-1 text-sm text-slate-500">Protegida con contraseña</p>
          <form onSubmit={(e) => void handleUnlock(e)} className="mt-4 flex flex-col gap-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Contraseña"
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            {passwordError && <p className="text-xs font-semibold text-red-500">{passwordError}</p>}
            <button
              type="submit"
              disabled={unlocking || !passwordInput}
              className="rounded-2xl px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-40"
              style={bgStyle}
            >
              {unlocking ? 'Verificando…' : 'Acceder'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const firstPanoramaSpace = data.spaces.find((s) => s.assets.some((a) => a.type === 'panorama_360'));
  const firstPanoramaAsset = firstPanoramaSpace?.assets.find((a) => a.type === 'panorama_360');
  const hasSplat = data.spaces.some((s) => s.assets.some((a) => a.type === 'gaussian_splat'));

  return (
    <div className="flex flex-col overflow-hidden rounded-[1.7rem] bg-white ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-violet-400/35 via-fuchsia-500/20 to-slate-950">
        {data.thumbnailUrl ? (
          <img src={data.thumbnailUrl} alt={data.title} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-white/20" aria-hidden="true"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h3 className="text-xl font-black leading-tight">{data.title}</h3>
          <p className="mt-0.5 text-sm text-white/75">{data.area} m² · {data.rooms} hab.</p>
        </div>
      </div>

      {/* Ficha */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-xl font-black dark:text-white">{formatCurrency(data.price)}</p>
        {data.description && (
          <p className="line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{data.description}</p>
        )}
        {data.address && (
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {data.address}
          </p>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-700 dark:text-white">{data.bathrooms} baños</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-700 dark:text-white">{data.spaces.length} estancias</span>
          {data.views !== undefined && data.views > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-bold dark:bg-slate-700 dark:text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {data.views}
            </span>
          )}
        </div>

        {/* Viewer actions */}
        {hasSplat && (
          <button
            type="button"
            onClick={() => navigate(`/property/${propertyId}`)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-black transition hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-700"
          >
            Abrir en visor completo →
          </button>
        )}
        {firstPanoramaAsset && !viewerVisible && (
          <button
            type="button"
            onClick={() => setViewerVisible(true)}
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90"
            style={bgStyle}
          >
            ▶ Cargar visor 360°
          </button>
        )}
        {viewerVisible && firstPanoramaAsset && (
          <button
            type="button"
            onClick={() => setViewerVisible(false)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Cerrar visor
          </button>
        )}
      </div>

      {/* Lazy panorama viewer */}
      {viewerVisible && firstPanoramaSpace && firstPanoramaAsset && (
        <ErrorBoundary fallback={<div className="h-[520px] flex items-center justify-center text-slate-400">Error al cargar el visor.</div>}>
          <Suspense fallback={<div className="h-[520px] animate-pulse bg-slate-100 dark:bg-slate-800" />}>
            <div className="border-t border-slate-100 dark:border-slate-700">
              <PanoramaViewer
                propertyId={propertyId}
                spaceId={firstPanoramaSpace.id}
                asset={firstPanoramaAsset}
                onHotspotClick={() => {}}
                onAnalyticsEvent={() => {}}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

export default function ComparePage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { bgStyle } = useBrand();
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3);

  if (ids.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h1 className="text-4xl font-black dark:text-white">Sin propiedades seleccionadas</h1>
        <p className="mt-4 text-slate-500">Selecciona 2 o 3 propiedades desde la galería para comparar.</p>
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="mt-8 rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90"
          style={bgStyle}
        >
          Ir a la galería
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/gallery')}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
        >
          ← Galería
        </button>
        <h1 className="text-3xl font-black dark:text-white">Comparar propiedades</h1>
      </div>
      <div
        className={`grid grid-cols-1 gap-6 ${
          ids.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        {ids.map((id) => (
          <CompareColumn key={id} propertyId={id} />
        ))}
      </div>
    </main>
  );
}
