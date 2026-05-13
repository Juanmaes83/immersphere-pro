import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UniversalViewer from '@/components/viewer/UniversalViewer';
import ChatbotWidget from '@/components/ChatbotWidget';
import { useAuthStore } from '@/store/authStore';
import { usePropertyStore } from '@/store/propertyStore';
import type { ViewerEvent } from '@/types/viewer';

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ??
  import.meta.env.VITE_API_URL ??
  'http://localhost:4000/api'
).replace(/\/$/, '');

export default function MobileViewerPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hydrateFromStorage } = useAuthStore();
  const { selectedProperty, fetchPropertyById, isLoading, error, clearSelectedProperty } = usePropertyStore();

  useEffect(() => {
    hydrateFromStorage();
    if (id) {
      void fetchPropertyById(id);
      fetch(`${API_BASE}/properties/${id}/view`, { method: 'POST' }).catch(() => {});
    }
    return () => { clearSelectedProperty(); };
  }, [id, fetchPropertyById, clearSelectedProperty, hydrateFromStorage]);

  function handleClose(): void {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
    }
  }

  function handleFullscreen(): void {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function handleAnalyticsEvent(_event: ViewerEvent): void {
    // no-op: mobile viewer fires analytics via UniversalViewer's own trackToBackend
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-sm font-bold text-white backdrop-blur">
          Cargando tour...
        </div>
      </div>
    );
  }

  if (error || !selectedProperty) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <p className="font-bold text-white/60">Propiedad no encontrada</p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-full bg-white/10 px-6 py-3 text-sm font-black hover:bg-white/20"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white">
      {/* Thin top bar: close + title + fullscreen */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/30 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar visor"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-black hover:bg-white/20"
        >
          ✕
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black leading-tight">{selectedProperty.title}</p>
          <p className="text-[11px] font-semibold text-white/45 leading-tight">
            {selectedProperty.spaces.length} estancia{selectedProperty.spaces.length !== 1 ? 's' : ''}
          </p>
        </div>
        {document.fullscreenEnabled ? (
          <button
            type="button"
            onClick={handleFullscreen}
            aria-label="Pantalla completa"
            title="Pantalla completa"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          >
            ⛶
          </button>
        ) : null}
      </div>

      {/* Viewer fills all remaining height */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <UniversalViewer
          propertyId={selectedProperty.id}
          spaces={selectedProperty.spaces}
          primaryColor="#7C3AED"
          className="h-full rounded-none border-0"
          onAnalyticsEvent={handleAnalyticsEvent}
        />
      </div>

      <ChatbotWidget
        propertyId={selectedProperty.id}
        propertyTitle={selectedProperty.title}
        tenantPhone={selectedProperty.tenantPhone}
        primaryColor="#7C3AED"
      />
    </div>
  );
}
