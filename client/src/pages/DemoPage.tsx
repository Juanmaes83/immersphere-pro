import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';

const DEMOS = [
  {
    title: 'Demo comercial ASAS',
    url: 'https://immersphere-pro.vercel.app/capture/a5924f50-7e7b-4173-95d3-23dae72e5cae',
    body: 'Landing comercial completa con viewer, hotspots, formulario de contacto, QR/ficha y contenido aplicado.',
    cta: 'Ver demo comercial',
    tags: ['Landing premium', 'Hotspots', 'Lead capture', 'QR / ficha'],
  },
  {
    title: 'Visor inmersivo - Property demo 1',
    url: 'https://immersphere-pro.vercel.app/property/94f8929a-d156-421e-9802-dffd6cb69c21',
    body: 'Experiencia desktop inmersiva a pantalla completa para recorrer una propiedad o espacio con navegacion visual.',
    cta: 'Abrir visor inmersivo',
    tags: ['Viewer a sangre', 'Desktop premium', 'Hotspots', 'Navegacion'],
  },
  {
    title: 'Visor inmersivo - Property demo 2',
    url: 'https://immersphere-pro.vercel.app/property/2fe0f03b-5631-4d21-8337-cf526428834c',
    body: 'Segunda demo de visor inmersivo para validar consistencia visual, navegacion y presentacion de espacios.',
    cta: 'Ver segunda demo',
    tags: ['Experiencia inmersiva', 'Presentacion comercial', 'Movil horizontal', 'Property viewer'],
  },
] as const;

const PROOF = [
  'Presentacion inmersiva de espacios.',
  'Landing comercial lista para compartir.',
  'Hotspots informativos y CTA contextuales.',
  'Captacion de leads sin salir de la experiencia.',
  'QR, enlace compartible y ficha imprimible.',
  'Experiencia optimizada para desktop y movil horizontal.',
  'Upload guiado y preparacion de materiales.',
  'IA aplicada a contenido comercial y recomendaciones.',
] as const;

const VERTICALS = [
  ['Inmobiliarias y agencias premium', 'Convierte una visita online en una experiencia mas convincente que una galeria de fotos.'],
  ['Promotoras y obra nueva', 'Presenta unidades, calidades y recorridos antes de la visita presencial.'],
  ['Arquitectura e interiorismo', 'Explica espacios, reformas o propuestas con una narrativa visual mas clara.'],
  ['Hoteles, resorts y casas rurales', 'Reduce incertidumbre y aumenta confianza antes de la reserva.'],
  ['Espacios comerciales y showrooms', 'Convierte un local, stand o showroom en una pieza de venta compartible.'],
  ['Turismo, patrimonio y rutas', 'Ayuda a descubrir lugares con contexto, recorrido y puntos destacados.'],
  ['Asociaciones comerciales y barrios', 'Agrupa espacios y negocios en experiencias digitales faciles de compartir.'],
] as const;

const WORKFLOW = [
  'Subes material',
  'Se organiza por estancia o zona',
  'Immersphere prepara viewer, contenido y hotspots',
  'Se publica una landing compartible',
  'El cliente comparte enlace, QR o ficha',
  'Los interesados dejan contacto o interactuan con la experiencia',
] as const;

const STABLE_NOW = [
  'Landing publica',
  'Viewer externo / property viewer',
  'Hotspots',
  'Lead capture',
  'QR / ficha',
  'Upload guiado',
  'IA aplicada',
  'Visor desktop inmersivo',
  'Movil horizontal optimizado',
] as const;

const FUTURE_RD = [
  'Viewer self-hosted',
  'R2 / SOG',
  'splat-transform',
  'Hotspots 3D nativos',
  'Pipeline avanzado de assets 3DGS',
] as const;

export default function DemoPage(): JSX.Element {
  const { bgStyle, colorStyle } = useBrand();
  const isAuthenticated = useAuthStore((state) => !!state.user);

  return (
    <main className="bg-[#F8FAFC] text-slate-950 dark:bg-slate-950 dark:text-white">
      <Helmet>
        <title>Demo comercial | Immersphere Pro</title>
        <meta
          name="description"
          content="Tres demos comerciales de Immersphere Pro para ver experiencias inmersivas con viewer, hotspots, leads, QR, ficha e IA aplicada."
        />
      </Helmet>

      <section className="bg-slate-950 px-5 py-16 text-white md:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                Demo comercial Immersphere Pro
              </p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Convierte espacios en experiencias inmersivas que venden.
              </h1>
              <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white/60">
                Immersphere Pro transforma propiedades, espacios y capturas inmersivas en experiencias comerciales
                listas para presentar, compartir y captar leads.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={DEMOS[0].url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                  Ver demo ASAS
                </a>
                <a href={DEMOS[1].url} target="_blank" rel="noreferrer" className="rounded-full px-6 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
                  Abrir visor inmersivo
                </a>
                <Link to="/capture-jobs" className="rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white">
                  Ir a CaptureJobs
                </Link>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/35">Que recibe el cliente</p>
              <p className="mt-4 text-2xl font-black leading-tight">
                No recibe solo un enlace a un tour. Recibe una pieza comercial visual, compartible, medible y preparada para captar oportunidades.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {['Viewer', 'Hotspots', 'Leads', 'QR', 'Ficha', 'IA aplicada'].map((item) => (
                  <span key={item} className="rounded-xl bg-white/10 px-3 py-2 text-center text-xs font-black text-white/75">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-14">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Demos disponibles</p>
                <h2 className="mt-2 text-3xl font-black">Tres pruebas comerciales listas para ensenar</h2>
              </div>
              <p className="max-w-xl text-sm font-semibold leading-6 text-white/45">
                Las demos actuales muestran el flujo estable de producto: landing, visor, hotspots, contacto, QR/ficha y presentacion inmersiva.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {DEMOS.map((demo) => (
                <article key={demo.title} className="flex flex-col rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl">
                  <h3 className="text-xl font-black">{demo.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-white/55">{demo.body}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {demo.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-violet-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-violet-100 ring-1 ring-violet-300/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <a href={demo.url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                    {demo.cta}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={colorStyle}>Que demuestra Immersphere</p>
            <h2 className="mt-3 text-3xl font-black">Una entrega comercial, no una demo tecnica suelta.</h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
              El flujo actual ya permite presentar un espacio con narrativa, interaccion y conversion. La tecnologia queda al servicio de una experiencia que el cliente entiende y puede compartir.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {PROOF.map((item) => (
                <p key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 ring-1 ring-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {VERTICALS.map(([title, body]) => (
              <article key={title} className="rounded-[1.35rem] bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <h3 className="text-base font-black">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={colorStyle}>Flujo de trabajo</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">Del material al enlace comercial compartible</h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {WORKFLOW.map((step, index) => (
                  <div key={step} className="rounded-[1.2rem] bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white" style={bgStyle}>{index + 1}</span>
                    <p className="mt-4 text-sm font-black text-slate-800 dark:text-white">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-slate-950 p-6 text-white">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">Produccion estable vs I+D</p>
              <p className="mt-3 text-sm font-semibold leading-7 text-white/55">
                Immersphere ya es util comercialmente con el flujo actual. La linea de I+D mejorara rendimiento, control y automatizacion de assets 3D avanzados.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-black text-emerald-300">Produccion estable actual</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {STABLE_NOW.map((item) => (
                      <span key={item} className="rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100 ring-1 ring-emerald-300/20">{item}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-300">I+D / evolucion futura</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {FUTURE_RD.map((item) => (
                      <span key={item} className="rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100 ring-1 ring-amber-300/20">{item}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href={DEMOS[0].url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-100">Ver demo ASAS</a>
                <a href={DEMOS[1].url} target="_blank" rel="noreferrer" className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white">Abrir visor inmersivo</a>
                <Link to={isAuthenticated ? '/capture-jobs' : '/register'} className="rounded-full px-5 py-3 text-sm font-black text-white transition hover:opacity-90" style={bgStyle}>
                  Crear CaptureJob
                </Link>
                <Link to="/capture-jobs" className="rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white">
                  Ir a CaptureJobs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
