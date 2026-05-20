import { useState } from 'react';

interface PropertyMapProps {
  lat: number;
  lng: number;
  title: string;
}

type Tab = 'map' | 'street';

// ── Component ─────────────────────────────────────────────────────────────────
// Uses Google Maps iframe embed (no API key required) + Nominatim geocoding.
// Street View tab opens in Google Maps directly (no key needed).
export default function PropertyMap({ lat, lng, title }: PropertyMapProps): JSX.Element {
  const [tab, setTab] = useState<Tab>('map');

  const gmapsUrl     = `https://www.google.com/maps?q=${lat},${lng}`;
  const streetViewUrl = `https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t/data=!3m1!1e3`;
  const embedUrl     = `https://maps.google.com/maps?q=${lat},${lng}&hl=es&z=16&output=embed`;

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

      {/* ── Map panel — iframe embed, no API key needed ── */}
      {tab === 'map' && (
        <iframe
          key={`map-${lat}-${lng}`}
          src={embedUrl}
          width="100%"
          height="320"
          style={{ border: 0, display: 'block' }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={title}
          allowFullScreen
        />
      )}

      {/* ── Street View panel — opens in Google Maps ── */}
      {tab === 'street' && (
        <div className="flex h-[320px] flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-800">
          <svg
            className="h-10 w-10 text-slate-300 dark:text-slate-600"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" strokeLinecap="round"/>
          </svg>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Street View se abre en Google Maps
          </p>
          <a
            href={streetViewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Abrir Street View →
          </a>
        </div>
      )}

    </section>
  );
}
