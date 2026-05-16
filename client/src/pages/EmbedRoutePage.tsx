import { lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

const PropertyDetailPage = lazy(() => import('@/pages/PropertyDetailPage'));

export default function EmbedRoutePage(): JSX.Element {
  const { id } = useParams();

  if (!id) {
    return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>Tour no encontrado.</div>;
  }

  return (
    <ErrorBoundary fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Error al cargar el tour.</div>}>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" /></div>}>
        <div className="bg-[#F8FAFC] text-slate-950">
          <PropertyDetailPage propertyId={id} embed />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
