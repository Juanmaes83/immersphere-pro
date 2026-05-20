import { useEffect, useRef, useState } from 'react';

// Minimal ambient types so TSC doesn't complain — full types come at runtime
declare global {
  interface Window {
    google: {
      maps: {
        Map: new (el: HTMLElement, opts: object) => object;
        Marker: new (opts: object) => object;
        StreetViewPanorama: new (el: HTMLElement, opts: object) => object;
        ControlPosition: { RIGHT_CENTER: number };
      };
    };
  }
}

interface PropertyMapProps {
  lat: number;
  lng: number;
  title: string;
}

type Tab = 'map' | 'street';

// ── Google Maps script loader (singleton) ─────────────────────────────────────
let _gmapsState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
const _gmapsCallbacks: Array<(ok: boolean) => void> = [];

function loadGoogleMaps(apiKey: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (_gmapsState === 'ready') { resolve(true); return; }
    if (_gmapsState === 'error') { resolve(false); return; }
    _gmapsCallbacks.push(resolve);
    if (_gmapsState === 'loading') return;
    _gmapsState = 'loading';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _gmapsState = 'ready';
      _gmapsCallbacks.splice(0).forEach(cb => cb(true));
    };
    script.onerror = () => {
      _gmapsState = 'error';
      _gmapsCallbacks.splice(0).forEach(cb => cb(false));
    };
    document.head.appendChild(script);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PropertyMap({ lat, lng, title }: PropertyMapProps): JSX.Element {
  const mapDivRef    = useRef<HTMLDivElement>(null);
  const streetDivRef = useRef<HTMLDivElement>(null);
  const mapObjRef    = useRef<object | null>(null);
  const svObjRef     = useRef<object | null>(null);

  const [tab, setTab]       = useState<Tab>('map');
  const [ready, setReady]   = useState(false);
  const [failed, setFailed] = useState(false);

  const apiKey    = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const gmapsUrl  = `https://www.google.com/maps?q=${lat},${lng}`;
  const position  = { lat, lng };

  // Load Google Maps script once
  useEffect(() => {
    if (!apiKey) { setFailed(true); return; }
    loadGoogleMaps(apiKey).then((ok) => {
      if (ok) setReady(true);
      else    setFailed(true);
    });
  }, [apiKey]);

  // Init Map
  useEffect(() => {
    if (!ready || !mapDivRef.current || mapObjRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = window.google;
    mapObjRef.current = new G.maps.Map(mapDivRef.current, {
      center: position,
      zoom: 16,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControlOptions: {
        position: G.maps.ControlPosition.RIGHT_CENTER,
      },
    });
    new G.maps.Marker({ position, map: mapObjRef.current, title });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Init Street View (lazy — only when tab first activated)
  useEffect(() => {
    if (!ready || tab !== 'street' || !streetDivRef.current || svObjRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const G = window.google;
    svObjRef.current = new G.maps.StreetViewPanorama(streetDivRef.current, {
      position,
      pov: { heading: 165, pitch: 0 },
      zoom: 1,
      addressControl: false,
      fullscreenControl: false,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab]);

  return (
    <section className="mt-8 overflow-hidden rounded-[1.6rem] ring-1 ring-slate-200 dark:ring-slate-700">

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTab('map')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold transition ${
            tab === 'map'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Mapa
        </button>

        <button
          type="button"
          onClick={() => setTab('street')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold transition ${
            tab === 'street'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" strokeLinecap="round"/>
          </svg>
          Street View
        </button>

        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-4 py-3 text-xs font-bold text-slate-400 transition hover:text-blue-600"
          title="Abrir en Google Maps"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="hidden sm:inline">Google Maps</span>
        </a>
      </div>

      {/* ── Map panel ── */}
      <div
        ref={mapDivRef}
        style={{ height: 320, display: tab === 'map' && ready ? 'block' : 'none' }}
      />

      {/* ── Street View panel ── */}
      <div
        ref={streetDivRef}
        style={{ height: 320, display: tab === 'street' && ready ? 'block' : 'none' }}
      />

      {/* ── Loading skeleton ── */}
      {!ready && !failed && (
        <div className="flex h-[320px] items-center justify-center bg-slate-50 dark:bg-slate-800">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* ── Error / no key ── */}
      {failed && (
        <div className="flex h-[320px] flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-800">
          <svg className="h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            Ver en Google Maps →
          </a>
        </div>
      )}
    </section>
  );
}
