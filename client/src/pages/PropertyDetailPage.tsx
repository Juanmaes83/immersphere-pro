import UniversalViewer from '@/components/viewer/UniversalViewer';
import type { Space, ViewerEvent } from '@/types/viewer';

interface PropertyDetailPageProps {
  property: {
    id: string;
    title: string;
    location: string;
    type: string;
    price: number;
    area: number;
    rooms: number;
    bathrooms: number;
    description: string;
    leadScore: number;
    visits: number;
    leads: number;
    spaces: Space[];
  } | null;
  primaryColor?: string;
  onBack: () => void;
  onAnalyticsEvent: (event: ViewerEvent) => void;
}

function formatCurrency(value: number): string {
  if (!value) return 'Consultar';

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}

function DetailStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export default function PropertyDetailPage({
  property,
  primaryColor = '#7C3AED',
  onBack,
  onAnalyticsEvent
}: PropertyDetailPageProps): JSX.Element {
  if (!property) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] pt-24 text-slate-950">
        <section className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-4xl font-black">Propiedad no encontrada</h1>
          <button
            type="button"
            onClick={onBack}
            className="mt-8 rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white"
          >
            Volver a galería
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-950">
      <section className="mx-auto max-w-7xl px-5 py-10">
        <button
          type="button"
          onClick={onBack}
          className="mb-5 rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
        >
          ← Volver a galería
        </button>

        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200/70">
          <div className="relative min-h-[420px] bg-gradient-to-br from-cyan-400/35 via-violet-500/20 to-slate-950">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
            <div className="relative flex min-h-[420px] flex-col justify-end p-7 text-white md:p-10">
              <div className="mb-5 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-4 py-2 text-xs font-black"
                  style={{ backgroundColor: primaryColor }}
                >
                  Visor universal
                </span>
                <span className="rounded-full bg-white/15 px-4 py-2 text-xs font-black backdrop-blur">
                  {property.type}
                </span>
              </div>
              <h1 className="max-w-4xl text-5xl font-black tracking-tight md:text-7xl">
                {property.title}
              </h1>
              <p className="mt-4 text-lg font-semibold text-white/75">{property.location}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 p-7 md:p-10 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <DetailStat label="Precio" value={formatCurrency(property.price)} />
                <DetailStat label="Superficie" value={`${property.area} m²`} />
                <DetailStat label="Habitaciones" value={property.rooms} />
                <DetailStat label="Baños" value={property.bathrooms} />
              </div>

              <section className="mt-8 rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200">
                <p
                  className="text-sm font-black uppercase tracking-[0.22em]"
                  style={{ color: primaryColor }}
                >
                  Descripción comercial
                </p>
                <p className="mt-4 leading-8 text-slate-600">{property.description}</p>
              </section>

              <UniversalViewer
                propertyId={property.id}
                spaces={property.spaces}
                primaryColor={primaryColor}
                className="mt-8"
                onAnalyticsEvent={onAnalyticsEvent}
              />
            </div>

            <aside className="rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200">
              <p
                className="text-sm font-black uppercase tracking-[0.22em]"
                style={{ color: primaryColor }}
              >
                Señales de intención
              </p>
              <div className="mt-5 space-y-4">
                <DetailStat label="Visitas inmersivas" value={formatNumber(property.visits)} />
                <DetailStat label="Leads generados" value={formatNumber(property.leads)} />
                <DetailStat label="Lead score" value={`${property.leadScore}/100`} />
              </div>
              <button
                type="button"
                className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Contactar agente
              </button>
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                En producción, este CTA abrirá lead, email, CRM o reserva de visita física.
              </p>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
