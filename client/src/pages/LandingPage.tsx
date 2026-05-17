import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export default function LandingPage(): JSX.Element {
  return (
    <main className="bg-[#050712] text-white">
      <Helmet>
        <title>Immersphere Pro · Tours inmersivos para inmobiliarias</title>
        <meta name="description" content="Plataforma SaaS de tours virtuales 360° y Gaussian Splats para inmobiliarias, constructoras y decoradores. White label, analytics y leads integrados." />
      </Helmet>
      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl grid-cols-1 gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">SaaS inmersivo B2B</p>
          <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.95] tracking-[-0.06em] md:text-7xl">
            Convierte espacios en decisiones de compra.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">
            Plataforma multi-tenant con 360°, Gaussian Splats, white label, analytics comercial y suscripciones Stripe.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link to="/register" className="rounded-full bg-white px-7 py-4 text-center text-sm font-black text-slate-950 hover:bg-violet-300">
              Crear tenant demo
            </Link>
            <Link to="/gallery" className="rounded-full border border-white/15 px-7 py-4 text-center text-sm font-black text-white hover:bg-white/10">
              Ver galería
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-violet-950/30">
          <div className="rounded-[1.6rem] bg-gradient-to-br from-violet-500/20 via-violet-700/20 to-slate-950 p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Plataforma</p>
            <h2 className="mt-5 text-4xl font-black">Plataforma en producción, lista para usar.</h2>
            <div className="mt-10 grid grid-cols-2 gap-3">
              {['JWT', 'API real', 'Stripe', 'Deploy'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/25 p-4 font-black">
                  ✓ {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
