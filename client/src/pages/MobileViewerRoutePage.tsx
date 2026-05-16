import { lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

const MobileViewerPage = lazy(() => import('@/pages/MobileViewerPage'));

export default function MobileViewerRoutePage(): JSX.Element {
  const { id } = useParams();
  if (!id) return <Navigate to="/gallery" replace />;
  return (
    <ErrorBoundary fallback={<div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white">Error al cargar el visor móvil.</div>}>
      <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
        <MobileViewerPage />
      </Suspense>
    </ErrorBoundary>
  );
}
