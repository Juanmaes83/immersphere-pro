import { lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

const PropertyDetailPage = lazy(() => import('@/pages/PropertyDetailPage'));

export default function PropertyRoutePage(): JSX.Element {
  const { id } = useParams();

  if (!id) {
    return <Navigate to="/gallery" replace />;
  }

  return (
    <ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Error al cargar la propiedad.</div>}>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
        <PropertyDetailPage propertyId={id} />
      </Suspense>
    </ErrorBoundary>
  );
}
