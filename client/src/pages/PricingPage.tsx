import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlanFeature {
  text: string;
  note?: string;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceSub?: string;
  badge?: string;
  badgeColor?: string;
  highlight: boolean;
  description: string;
  features: PlanFeature[];
  cta: string;
  ctaHref: string;
  ctaStyle: 'primary' | 'outline' | 'ghost';
}

// ── Plan data ─────────────────────────────────────────────────────────────────

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '59 €',
    priceSub: '/mes · 1er mes gratis',
    badge: '1er mes gratis',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    highlight: false,
    description: 'Para agentes independientes y pequeñas agencias que quieren publicar tours profesionales sin complicaciones.',
    features: [
      { text: 'Hasta 5 propiedades activas' },
      { text: '1 usuario' },
      { text: 'Tours 360° inmersivos' },
      { text: 'Share link + QR' },
      { text: 'CTA WhatsApp integrado' },
      { text: 'Google Maps / Street View' },
      { text: 'Lead capture básico' },
      { text: 'Analytics básicos' },
    ],
    cta: 'Empezar gratis',
    ctaHref: '/register',
    ctaStyle: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '149 €',
    priceSub: '/mes',
    badge: 'Más popular',
    badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    highlight: true,
    description: 'Para agencias consolidadas que necesitan storytelling visual avanzado, analytics de engagement y tours protegidos.',
    features: [
      { text: 'Todo Starter' },
      { text: 'Hasta 25 propiedades activas' },
      { text: 'Hasta 3 usuarios' },
      { text: 'Hero vídeo por propiedad' },
      { text: 'Storytelling por espacio' },
      { text: 'Auto-tour cinematográfico' },
      { text: 'Analytics de engagement' },
      { text: 'Tours con contraseña' },
      { text: 'Gaussian viewer disponible', note: 'Producción no incluida' },
    ],
    cta: 'Activar Pro',
    ctaHref: '/register',
    ctaStyle: 'primary',
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '349 €',
    priceSub: '/mes',
    highlight: false,
    description: 'Para agencias con volumen, grupos o redes que necesitan white-label, multiusuario y reporting para clientes.',
    features: [
      { text: 'Todo Pro' },
      { text: 'Hasta 100 propiedades activas' },
      { text: 'Hasta 10 usuarios' },
      { text: 'White-label (logo + color agencia)' },
      { text: 'Embed iframe en tu web' },
      { text: 'PDF reports descargables' },
      { text: 'Soporte prioritario' },
    ],
    cta: 'Activar Agency',
    ctaHref: '/register',
    ctaStyle: 'outline',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Bajo diagnóstico',
    highlight: false,
    description: 'Para promotoras, grupos inmobiliarios y organizaciones con necesidades avanzadas de integración y escala.',
    features: [
      { text: 'Propiedades según volumen' },
      { text: 'Usuarios ilimitados' },
      { text: 'Dominios personalizados' },
      { text: 'Integraciones CRM / API' },
      { text: 'Automatización avanzada' },
      { text: 'Reporting a medida' },
      { text: 'Soporte específico dedicado' },
    ],
    cta: 'Concertar reunión',
    ctaHref: 'tel:+34629554870',
    ctaStyle: 'ghost',
  },
];

const STUDIO_SERVICES: string[] = [
  'Vídeo comercial de propiedad',
  'Landing premium de campaña',
  'SEO / GEO local inmobiliario',
  'Campañas Google Ads / SEM',
  'Campañas Meta Ads',
  'Social Media Ads',
  'Copywriting inmobiliario',
  'Branding para agencias y promotoras',
  'Dossier comercial / presentación',
  'Lead generation',
  'Automatización CRM',
];

// ── Subcomponents ─────────────────────────────────────────────────────────────

function CheckIcon(): JSX.Element {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function PlanCard({ plan }: { plan: Plan }): JSX.Element {
  const { bgStyle } = useBrand();

  const ctaClass =
    plan.ctaStyle === 'primary'
      ? 'w-full rounded-2xl py-3 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]'
      : plan.ctaStyle === 'outline'
      ? 'w-full rounded-2xl border-2 border-slate-200 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
      : 'w-full rounded-2xl border-2 border-transparent py-3 text-sm font-black text-slate-600 transition hover:bg-slate-100 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-7 transition-shadow ${
        plan.highlight
          ? 'border-violet-300 bg-white shadow-xl shadow-violet-100/60 dark:border-violet-700 dark:bg-slate-900 dark:shadow-violet-900/30'
          : 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
      }`}
    >
      {/* Highlight ring */}
      {plan.highlight && (
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-violet-400/60 dark:ring-violet-600/50" />
      )}

      {/* Badge */}
      {plan.badge && (
        <span className={`mb-4 inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ${plan.badgeColor ?? 'bg-slate-100 text-slate-600'}`}>
          {plan.badge}
        </span>
      )}

      {/* Name + Price */}
      <h3 className="text-xl font-black text-slate-900 dark:text-white">{plan.name}</h3>
      <div className="mt-2 flex items-end gap-1">
        <span className="text-3xl font-black text-slate-900 dark:text-white">{plan.price}</span>
        {plan.priceSub && (
          <span className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">{plan.priceSub}</span>
        )}
      </div>

      {/* Description */}
      <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{plan.description}</p>

      {/* CTA */}
      <div className="mt-6">
        {plan.ctaHref.startsWith('tel:') || plan.ctaHref.startsWith('http') ? (
          <a
            href={plan.ctaHref}
            className={ctaClass}
            style={plan.ctaStyle === 'primary' ? bgStyle : undefined}
          >
            {plan.cta}
          </a>
        ) : (
          <Link
            to={plan.ctaHref}
            className={ctaClass}
            style={plan.ctaStyle === 'primary' ? bgStyle : undefined}
          >
            {plan.cta}
          </Link>
        )}
      </div>

      {/* Divider */}
      <div className="my-6 border-t border-slate-100 dark:border-slate-800" />

      {/* Features */}
      <ul className="space-y-2.5">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <CheckIcon />
            <span>
              {f.text}
              {f.note && (
                <span className="ml-1 text-xs font-bold text-slate-400 dark:text-slate-500">({f.note})</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage(): JSX.Element {
  const { bgStyle, colorStyle } = useBrand();

  return (
    <>
      <Helmet>
        <title>Precios · Immersphere Pro</title>
        <meta name="description" content="Planes SaaS y servicios Studio para agencias inmobiliarias. Desde 59 €/mes. Primer mes gratis." />
      </Helmet>

      <main className="mx-auto max-w-7xl px-5 pb-24 pt-16">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-16 text-center">
          <span
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            SaaS inmobiliario · Activo desde el día 1
          </span>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Planes claros.<br />
            <span style={colorStyle}>Sin sorpresas.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
            Publica tours 360° profesionales, activa vídeo hero por propiedad y convierte visitas en leads.
            Todo desde un mismo panel. Sin instalaciones. Sin comisiones.
          </p>
        </div>

        {/* ── Plan cards ───────────────────────────────────────────────── */}
        <section aria-label="Planes de suscripción">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>

        {/* ── Annual note ──────────────────────────────────────────────── */}
        <div className="mt-8 flex justify-center">
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            💡 Pago anual: <span className="text-slate-700 dark:text-slate-200">10 meses + 2 gratis</span> el primer año · Pilot Agency: consulta condiciones especiales a{' '}
            <a href="tel:+34629554870" className="font-black text-slate-700 hover:underline dark:text-slate-200">629 554 870</a>
          </p>
        </div>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div className="my-20 border-t border-slate-100 dark:border-slate-800" />

        {/* ── Immersphere Studio ───────────────────────────────────────── */}
        <section aria-label="Immersphere Studio — servicios opcionales">
          <div className="mb-10 text-center">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Studio opcional
            </span>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Immersphere Studio
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500 dark:text-slate-400">
              No solo publicamos tours. Ayudamos a convertir propiedades en campañas comerciales
              listas para captar visitas, leads y compradores.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-10">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {STUDIO_SERVICES.map((service) => (
                <div
                  key={service}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{service}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-black text-slate-700 dark:text-slate-200">Sin precios publicados por diseño.</span>{' '}
                Los servicios Studio se presupuestan según alcance, propiedad, mercado y objetivos comerciales.
                Cada campaña es diferente. Hablamos.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="tel:+34629554870"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07.03h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.01z" />
                </svg>
                Llamar al 629 554 870
              </a>
              <a
                href="mailto:hola@immersphere.pro"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]"
                style={bgStyle}
              >
                Concertar reunión
              </a>
            </div>
          </div>
        </section>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div className="my-20 border-t border-slate-100 dark:border-slate-800" />

        {/* ── Gaussian Studio ──────────────────────────────────────────── */}
        <section aria-label="Gaussian Studio — producción premium">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl dark:border-slate-700">
            <div className="px-8 py-12 md:px-12">
              <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">

                {/* Left */}
                <div className="flex-1">
                  <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white/70">
                    Servicio premium
                  </span>
                  <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    Gaussian Studio
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-slate-300">
                    Servicio premium asistido para propiedades especiales: villas, hoteles, showrooms y
                    promociones donde el impacto visual justifica producción avanzada.
                  </p>
                  <p className="mt-3 text-sm text-slate-400">
                    El visor Gaussian está disponible en planes Pro y superiores. La producción —
                    captura, procesado y optimización del modelo 3D — es un servicio separado que
                    se presupuesta bajo diagnóstico previo.
                  </p>

                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {[
                      'Captura en ubicación',
                      'Procesado Gaussian Splat',
                      'Optimización para web',
                      'Integración en tu tour',
                      'Revisión y entrega',
                      'Diagnóstico previo gratuito',
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden="true" />
                        <span className="text-sm font-bold text-slate-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right */}
                <div className="flex-shrink-0 lg:w-72">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                    <p className="mb-1 text-xs font-black uppercase tracking-widest text-white/50">Disponibilidad</p>
                    <p className="text-sm font-bold text-white">Viewer en plan Pro+</p>
                    <div className="my-4 border-t border-white/10" />
                    <p className="mb-1 text-xs font-black uppercase tracking-widest text-white/50">Producción</p>
                    <p className="text-sm font-bold text-white">Bajo diagnóstico · Precio según proyecto</p>
                    <div className="my-4 border-t border-white/10" />
                    <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/50">Mobile</p>
                    <p className="text-sm font-bold text-slate-300">Optimizado para web desktop. Mejora progresiva en mobile.</p>
                    <div className="mt-6 flex flex-col gap-3">
                      <a
                        href="tel:+34629554870"
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 py-3 text-sm font-black text-white transition hover:bg-white/10 active:scale-[0.98]"
                      >
                        Solicitar diagnóstico
                      </a>
                      <a
                        href="tel:+34629554870"
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-black text-white transition hover:bg-violet-500 active:scale-[0.98]"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07.03h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.01z" />
                        </svg>
                        629 554 870
                      </a>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className="mt-20 text-center" aria-label="Llamada a la acción">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            ¿Tienes preguntas antes de empezar?
          </h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Llamamos, respondemos y si hace falta preparamos una demo en vivo.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="tel:+34629554870"
              className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 px-6 py-3 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.07 1.18 2 2 0 012.07.03h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11l-1.27 1.27a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7a2 2 0 011.72 2.01z" />
              </svg>
              629 554 870
            </a>
            <Link
              to="/register"
              className="flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]"
              style={bgStyle}
            >
              Crear cuenta · 1er mes gratis
            </Link>
          </div>
          <p className="mt-5 text-xs font-bold text-slate-400">
            Sin tarjeta de crédito para empezar · Cancela cuando quieras
          </p>
        </section>

      </main>
    </>
  );
}
