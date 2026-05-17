import { Link } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';

export default function BillingSuccessPage(): JSX.Element {
  const { bgStyle } = useBrand();
  return (
    <main className="mx-auto max-w-3xl px-5 py-20 text-center">
      <h1 className="text-5xl font-black">Suscripción actualizada</h1>
      <p className="mt-4 text-slate-500">Pago confirmado. Tu plan se actualizará en unos segundos.</p>
      <Link to="/settings" className="mt-8 inline-flex rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
        Ver mi plan
      </Link>
    </main>
  );
}
