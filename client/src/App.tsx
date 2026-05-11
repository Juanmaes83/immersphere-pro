import { useState } from 'react';
import { demoProperty } from '@/data/demoProperties';
import PropertyDetailPage from '@/pages/PropertyDetailPage';
import type { ViewerEvent } from '@/types/viewer';

export default function App(): JSX.Element {
  const [events, setEvents] = useState<ViewerEvent[]>([]);

  function handleAnalyticsEvent(event: ViewerEvent): void {
    setEvents((current) => [event, ...current].slice(0, 6));
  }

  function handleBack(): void {
    setEvents([]);
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-700">
              Immersphere Pro
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Fase 4 · Gaussian Splatting</h1>
          </div>
          <a
            href="https://github.com/"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700"
          >
            Preparado para GitHub
          </a>
        </div>
      </header>

      <PropertyDetailPage
        property={demoProperty}
        primaryColor="#7C3AED"
        onBack={handleBack}
        onAnalyticsEvent={handleAnalyticsEvent}
      />

      <aside className="fixed bottom-4 left-4 z-50 hidden max-w-sm rounded-2xl bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur lg:block">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Eventos visor</p>
        {events.length === 0 ? (
          <p className="mt-2 text-xs text-white/50">Interactúa con el visor para generar eventos.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded-xl bg-white/10 p-2">
                <p className="text-xs font-bold text-white/75">{event.type}</p>
                <p className="mt-1 text-[11px] text-white/45">
                  {event.spaceId ?? 'sin-space'} · {event.assetId ?? 'sin-asset'}
                </p>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
