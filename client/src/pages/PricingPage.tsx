import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';
import { M, loadGSAP } from '@/lib/motion';

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
      { text: 'Share link + QR Kit descargable (PNG)' },
      { text: 'CTA WhatsApp integrado' },
      { text: 'Google Maps / Street View' },
      { text: 'Lead capture básico' },
      { text: 'Analytics básicos' },
      { text: 'Simulador de hipoteca integrado' },
      { text: 'Ficha PDF del comprador' },
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
      { text: 'Botón "Reservar visita" (Calendly)' },
      { text: 'Realidad Aumentada (AR) en móvil' },
      { text: 'Hotspot tipo Precio' },
      { text: 'Lead reminders automáticos' },
      { text: 'Mapa interactivo + análisis del barrio' },
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
      { text: 'Ficha PDF white-label (logo + color)' },
      { text: 'PDF reports de rendimiento' },
      { text: 'Top Properties dashboard — ranking semanal' },
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

// Producción visual — el servicio estrella (GitHub Pages portfolio)
const VISUAL_SERVICES: string[] = [
  'Vídeo comercial de propiedad (drone + interior cinemático)',
  'Renders fotorrealistas 3D',
  'Tour virtual producido (lo hacemos nosotros)',
  'Visualización arquitectónica y pre-venta sobre plano',
  'Reportaje fotográfico profesional',
  'Animación y walkthrough cinematográfico',
];

// Marketing & performance — servicios complementarios
const MARKETING_SERVICES: string[] = [
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

const STUDIO_CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/';
const STUDIO_BG = `${STUDIO_CDN}hf_20260522_132626_aa68d171-d7a0-416c-bcf1-4375eeb6ce71_min.webp`;
const STUDIO_INTERIOR = `${STUDIO_CDN}hf_20260519_071439_c326a27b-7139-4e2a-9a23-0f498086c353.png`;

// ── Studio videos (Cloudinary CDN) ───────────────────────────────────────────
const CDN_VIDEO = 'https://res.cloudinary.com/dgbgriykc/video/upload/f_auto,q_auto:good,w_960/immersphere-studio';
const CDN_POSTER = 'https://res.cloudinary.com/dgbgriykc/video/upload/so_2,w_960/immersphere-studio';
const STUDIO_VIDEOS: { src: string; poster: string; label: string; tag: string }[] = [
  { src: `${CDN_VIDEO}/renders/inmobiliarias_09.mp4`,        poster: `${CDN_POSTER}/renders/inmobiliarias_09.jpg`,        label: 'Tour inmobiliario — producción propia',       tag: 'Inmobiliaria' },
  { src: `${CDN_VIDEO}/renders/render_inmobiliarias_02.mp4`, poster: `${CDN_POSTER}/renders/render_inmobiliarias_02.jpg`, label: 'Render inmobiliario cinemático',              tag: 'Inmobiliaria' },
  { src: `${CDN_VIDEO}/renders/render_01.mp4`,               poster: `${CDN_POSTER}/renders/render_01.jpg`,               label: 'Render cinemático — producción propia',       tag: 'Studio'       },
  { src: `${CDN_VIDEO}/renders/reel_0527.mp4`,               poster: `${CDN_POSTER}/renders/reel_0527.jpg`,               label: 'Reel de producción 2025',                     tag: 'Studio'       },
  { src: `${CDN_VIDEO}/renders/render_espacios_01.mp4`,      poster: `${CDN_POSTER}/renders/render_espacios_01.jpg`,      label: 'Espacios interiores — render fotorrealista',  tag: 'Interior'     },
  { src: `${CDN_VIDEO}/renders/render_espacios_02.mp4`,      poster: `${CDN_POSTER}/renders/render_espacios_02.jpg`,      label: 'Espacios de lujo — visualización 3D',         tag: 'Interior'     },
  { src: `${CDN_VIDEO}/renders/render_decoracion.mp4`,       poster: `${CDN_POSTER}/renders/render_decoracion.jpg`,       label: 'Decoración e interiorismo premium',           tag: 'Decoración'   },
  { src: `${CDN_VIDEO}/inmobiliarias/06.mp4`,                poster: `${CDN_POSTER}/inmobiliarias/06.jpg`,                label: 'Tour exclusivo — captación premium',          tag: 'Inmobiliaria' },
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
      className={`motion-plan-card relative flex flex-col rounded-3xl border p-7 transition-shadow ${
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
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // eslint-disable-next-line prefer-const
    let ctx: any;
    loadGSAP().then(({ gsap, ScrollTrigger, SplitText }) => {
      ctx = gsap.context(() => {

        // Hero image — cinematic scale-in
        gsap.from('.motion-hero-img', {
          scale: 1.06,
          duration: M.cinematic,
          ease: M.ease,
        });

        // Badge chip
        gsap.from('.motion-hero-badge', {
          y: 14,
          opacity: 0,
          duration: M.base,
          ease: M.ease,
          delay: 0.25,
        });

        // Headline — SplitText line-by-line reveal
        const headlineEl = document.querySelector<HTMLElement>('.motion-hero-h1');
        if (headlineEl) {
          const split = new SplitText(headlineEl, { type: 'lines' });
          gsap.from(split.lines, {
            y: 44,
            opacity: 0,
            duration: M.base,
            stagger: M.stagger * 1.5,
            ease: M.ease,
            delay: 0.4,
          });
        }

        // Sub-headline
        gsap.from('.motion-hero-sub', {
          y: 18,
          opacity: 0,
          duration: M.base,
          ease: M.ease,
          delay: 0.72,
        });

        // Plan cards — stagger on scroll
        gsap.set('.motion-plan-card', { y: 36, opacity: 0 });
        ScrollTrigger.batch('.motion-plan-card', {
          onEnter: (els) =>
            gsap.to(els, {
              y: 0,
              opacity: 1,
              duration: M.base,
              stagger: M.stagger,
              ease: M.ease,
            }),
          start: M.scrollStart,
          once: true,
        });

        // Studio service items — stagger from left
        gsap.set('.motion-studio-item', { x: -14, opacity: 0 });
        ScrollTrigger.batch('.motion-studio-item', {
          onEnter: (els) =>
            gsap.to(els, {
              x: 0,
              opacity: 1,
              duration: M.fast,
              stagger: M.staggerFast,
              ease: M.ease,
            }),
          start: 'top 88%',
          once: true,
        });

        // Section headings reveal
        gsap.utils.toArray<Element>('.motion-section-h2').forEach((el) => {
          gsap.from(el, {
            y: 22,
            opacity: 0,
            duration: M.base,
            ease: M.ease,
            scrollTrigger: { trigger: el, start: M.scrollStart, once: true },
          });
        });

        // Gaussian — image ambient drift
        gsap.to('.motion-gaussian-img', {
          scale: 1.06,
          duration: 14,
          ease: M.easeSine,
          repeat: -1,
          yoyo: true,
        });

        // Gaussian — glow pulse
        gsap.to('.motion-gaussian-glow', {
          opacity: 0.28,
          duration: 5,
          ease: M.easeSine,
          repeat: -1,
          yoyo: true,
        });

        // "Por qué" right column reveal
        gsap.from('.motion-why-content', {
          x: 28,
          opacity: 0,
          duration: M.slow,
          ease: M.ease,
          scrollTrigger: {
            trigger: '.motion-why-content',
            start: 'top 80%',
            once: true,
          },
        });

      }, mainRef);
    });
    return () => ctx?.revert();
  }, []);

  return (
    <>
      <Helmet>
        <title>Precios · Immersphere Pro</title>
        <meta name="description" content="Planes SaaS y servicios Studio para agencias inmobiliarias. Desde 59 €/mes. Primer mes gratis." />
      </Helmet>

      <main ref={mainRef} className="mx-auto max-w-7xl px-5 pb-24 pt-16">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-16">
          {/* Image hero */}
          <div className="relative mb-12 overflow-hidden rounded-3xl bg-slate-900 shadow-2xl" style={{ minHeight: '360px' }}>
            <img
              src="/images/pricing-hero-agent-tablet.webp"
              alt="Agente inmobiliaria mostrando tour virtual en tablet dentro de villa premium"
              className="motion-hero-img h-full w-full object-cover opacity-80"
              style={{ minHeight: '360px' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center px-10 py-12 md:px-16">
              <span className="motion-hero-badge mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white/80 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                SaaS inmobiliario · Activo desde el día 1
              </span>
              <h1 className="motion-hero-h1 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
                La plataforma de tours inmersivos<br />
                <span className="text-white">para agencias inmobiliarias.</span>
              </h1>
              <p className="motion-hero-hook mt-3 text-lg font-black text-violet-300 sm:text-xl">
                Tu cliente ya querrá vivir allí desde que recibe tu primera imagen.
              </p>
              <p className="motion-hero-sub mt-3 max-w-xl text-sm text-white/65 md:text-base">
                Publica un tour 360° o 3D en 5 minutos. El comprador lo recorre desde su móvil,
                sin app, sin instalar nada. Tú recibes el lead directo.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Sin app · Sin instalación · Cualquier dispositivo', 'Tour en 5 minutos · 1er mes gratis', 'Leads directo a tu panel'].map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-black text-white/80 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Why Immersphere strip (above plans) ──────────────────────── */}
        <div className="mb-8 rounded-2xl border border-violet-200/40 bg-violet-50/60 px-6 py-5 dark:border-violet-800/30 dark:bg-violet-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-500 dark:text-violet-400">¿Por qué Immersphere?</p>
              <p className="mt-1 text-base font-black text-slate-900 dark:text-white">
                Tu cliente ya querrá vivir allí desde que recibe tu primera imagen.
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Tours 360° y 3D · Sin app · Lead directo · Simulador de hipoteca incluido · Comparte en portales, RRSS y WhatsApp
              </p>
            </div>
            <Link
              to="/register"
              className="shrink-0 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-500 active:scale-[0.98]"
            >
              Empezar gratis →
            </Link>
          </div>
        </div>

        {/* ── Brand video — From Listing to Living ─────────────────────── */}
        <div className="mb-10 overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
          <div className="text-center px-6 pt-6 pb-3">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-400 mb-1">
              Cómo funciona en la realidad
            </p>
            <h2 className="text-lg font-black text-white md:text-xl">
              Del listado a las llaves —{' '}
              <span className="text-violet-300">una historia real en 15 segundos</span>
            </h2>
          </div>
          <div className="relative px-4 pb-4">
            <video
              src="https://raw.githubusercontent.com/Juanmaes83/immersphere-pro/main/VIDEO%20IMMERSPHERE%20PRO.mp4"
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-2xl"
              style={{ aspectRatio: '16/9' }}
              aria-label="Immersphere Pro — Del listado a la venta. Historia de marca."
            />
          </div>
          <div className="relative hidden">
            <video
              src={`${CDN_VIDEO.replace('w_960', 'w_1280')}/renders/reel_0527.mp4`}
              poster={`${CDN_POSTER.replace('w_960', 'w_1280')}/renders/reel_0527.jpg`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-64 w-full object-cover opacity-90 md:h-80"
              aria-hidden="true"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 p-6 md:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">Immersphere Studio · Producción propia</p>
              <p className="mt-1 text-xl font-black text-white md:text-2xl">
                Tu cliente ya querrá vivir allí desde que recibe tu primera imagen.
              </p>
              <p className="mt-1 text-sm text-white/55">
                Renders fotorrealistas · Vídeo con drone · Tours producidos · Fotografía · Marketing digital
              </p>
            </div>
          </div>
        </div>

        {/* ── Plan cards ───────────────────────────────────────────────── */}
        <section aria-label="Planes de suscripción">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>

        {/* ── No-app guarantee ─────────────────────────────────────────── */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <span className="flex items-center gap-2 text-sm font-black text-emerald-700 dark:text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Accesible al instante desde cualquier dispositivo.
            </span>
            <span className="hidden text-emerald-200 dark:text-emerald-800 sm:inline">·</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">Sin app. Sin instalación. Desde cualquier móvil.</span>
          </div>
        </div>

        {/* ── Platform preview ─────────────────────────────────────────── */}
        <section className="mt-16" aria-label="Vista previa de la plataforma">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-600 dark:text-violet-400">La plataforma por dentro</p>
            <h2 className="motion-section-h2 mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Panel real. Sin demo de feria.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500 dark:text-slate-400">
              Dashboard de propiedades, gestión de leads y analytics de engagement. Todo en una plataforma que funciona desde el día 1.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              {
                src: `https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/hf_20260515_113419_d90274ef-7e44-4ea0-ac2d-df325d381b89_min.webp`,
                alt: 'Dashboard completo de Immersphere Pro — propiedades, leads y analytics',
                label: 'Dashboard de agencia',
              },
              {
                src: `https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/hf_20260515_113521_20cd50a0-fad4-4fcf-8cea-eb5ebc2a79e0_min.webp`,
                alt: 'Bandeja de leads en tiempo real — estados, seguimiento y acciones WhatsApp',
                label: 'Gestión de leads',
              },
              {
                src: `https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/hf_20260515_113543_95afafcb-2537-4c08-be08-acb2da474b77_min.webp`,
                alt: 'Estados vacíos y vistas móviles de Immersphere Pro',
                label: 'Vista móvil operacional',
              },
            ] as { src: string; alt: string; label: string }[]).map(({ src, alt, label }) => (
              <div key={label} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="aspect-square overflow-hidden">
                  <img
                    src={src}
                    alt={alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <p className="px-4 py-3 text-center text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Annual note ──────────────────────────────────────────────── */}
        <div className="mt-4 flex justify-center">
          <p className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline h-3.5 w-3.5 align-middle mr-1" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{' '}
            Pago anual: <span className="text-slate-700 dark:text-slate-200">10 meses + 2 gratis</span> el primer año · Pilot Agency: consulta condiciones especiales a{' '}
            <a href="tel:+34629554870" className="font-black text-slate-700 hover:underline dark:text-slate-200">629 554 870</a>
          </p>
        </div>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div className="my-20 border-t border-slate-100 dark:border-slate-800" />

        {/* ── Immersphere Studio ───────────────────────────────────────── */}
        <section id="studio" aria-label="Immersphere Studio — servicios opcionales">
          {/* Header */}
          <div className="mb-10 text-center">
            <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Studio opcional
            </span>
            <h2 className="motion-section-h2 text-3xl font-black tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Immersphere Studio
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-500 dark:text-slate-400">
              No solo publicamos tours. Producimos el contenido visual y lanzamos la campaña completa
              para que cada propiedad llegue a más compradores, más rápido.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {/* Block 1 — Producción Visual (hero dark card) */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl dark:border-slate-700">
              {/* Background image */}
              <div className="pointer-events-none absolute inset-0">
                <img
                  src={STUDIO_BG}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover opacity-20"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/40" />
              </div>

              <div className="relative z-10 grid gap-10 p-8 md:grid-cols-2 md:p-12">
                {/* Left: text + services */}
                <div>
                  <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-400">
                    🎬 Producción Visual
                  </span>
                  <h3 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl">
                    Nosotros lo producimos<br />por ti.
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    Desde el drone hasta el render. Entregamos contenido listo para publicar en portales,
                    webs y redes sociales — sin que muevas un dedo.
                  </p>

                  <ul className="mt-6 flex flex-col gap-2.5">
                    {VISUAL_SERVICES.map((service) => (
                      <li key={service} className="flex items-start gap-3">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                        <span className="text-sm font-semibold text-slate-200">{service}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Stats */}
                  <div className="mt-8 flex gap-6">
                    <div>
                      <p className="text-2xl font-black text-white">40+</p>
                      <p className="text-xs font-semibold text-slate-400">proyectos producidos</p>
                    </div>
                    <div className="w-px bg-slate-700" />
                    <div>
                      <p className="text-2xl font-black text-white">98%</p>
                      <p className="text-xs font-semibold text-slate-400">clientes satisfechos</p>
                    </div>
                  </div>
                </div>

                {/* Right: portfolio preview + CTAs */}
                <div className="flex flex-col justify-between gap-6">
                  {/* Portfolio — autoplay video */}
                  <a
                    href="https://juanmaes83.github.io/IMMERSPHERE-PRO-INMOBILIARIAS/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block overflow-hidden rounded-2xl border border-white/10"
                    aria-label="Ver portfolio de producción Immersphere Studio"
                  >
                    <div className="relative">
                      <video
                        src="https://res.cloudinary.com/dgbgriykc/video/upload/f_auto,q_auto:good,w_800/immersphere-studio/renders/render_01.mp4"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] md:h-56"
                        aria-hidden="true"
                      />
                      <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-amber-300 transition-colors">
                          Ver portfolio completo →
                        </p>
                        <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-black text-slate-900">40+ proyectos</span>
                      </div>
                    </div>
                  </a>

                  {/* CTAs */}
                  <div className="flex flex-col gap-3">
                    <a
                      href="https://juanmaes83.github.io/IMMERSPHERE-PRO-INMOBILIARIAS/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-[0.98]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      Ver portfolio de producción
                    </a>
                    <a
                      href="https://wa.me/34629554870?text=Hola%2C%20me%20interesa%20la%20producci%C3%B3n%20visual%20de%20Immersphere%20Studio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]"
                      style={bgStyle}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.272a.75.75 0 00.921.921l5.427-1.471A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.934 0-3.745-.512-5.308-1.407l-.38-.218-3.94 1.069 1.069-3.94-.218-.38A9.952 9.952 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                      </svg>
                      Pedir presupuesto por WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Block 1b — Video reel strip (Cloudinary CDN) */}
            <div>
              <p className="mb-4 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                Muestra de trabajos reales — producción Immersphere Studio
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {STUDIO_VIDEOS.map((v) => (
                  <button
                    key={v.src}
                    type="button"
                    aria-label={`Reproducir: ${v.label}`}
                    className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-black text-left dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    onClick={(e) => {
                      const vid = e.currentTarget.querySelector('video') as HTMLVideoElement | null;
                      if (!vid) return;
                      const icon = e.currentTarget.querySelector('.play-icon') as HTMLElement | null;
                      if (vid.paused) { void vid.play(); if (icon) icon.style.opacity = '0'; }
                      else { vid.pause(); if (icon) icon.style.opacity = '1'; }
                    }}
                    onMouseEnter={(e) => {
                      const vid = e.currentTarget.querySelector('video') as HTMLVideoElement | null;
                      if (vid?.paused) void vid.play();
                    }}
                    onMouseLeave={(e) => {
                      const vid = e.currentTarget.querySelector('video') as HTMLVideoElement | null;
                      if (vid) { vid.pause(); vid.currentTime = 0; }
                      const icon = e.currentTarget.querySelector('.play-icon') as HTMLElement | null;
                      if (icon) icon.style.opacity = '1';
                    }}
                  >
                    <video
                      src={v.src}
                      poster={v.poster}
                      muted
                      loop
                      playsInline
                      preload="none"
                      className="h-44 w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
                      <p className="text-xs font-bold leading-tight text-white">{v.label}</p>
                      <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-black text-slate-900">{v.tag}</span>
                    </div>
                    <div className="play-icon absolute inset-0 flex items-center justify-center transition-opacity duration-200 group-hover:opacity-70" style={{ opacity: 1 }}>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm ring-2 ring-white/30">
                        <svg className="h-5 w-5 translate-x-0.5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                Haz clic o pasa el ratón para reproducir ·{' '}
                <a
                  href="https://juanmaes83.github.io/IMMERSPHERE-PRO-INMOBILIARIAS/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-amber-500 hover:underline"
                >
                  Ver portfolio completo →
                </a>
              </p>
            </div>

            {/* Block 2 — Marketing & Performance (secondary card) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:p-10">
              <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
                    📈 Marketing &amp; Performance
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    De la propiedad a la venta
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Estrategia digital completa para que cada tour genere leads reales.
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {MARKETING_SERVICES.map((service) => (
                  <div
                    key={service}
                    className="motion-studio-item flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" aria-hidden="true" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{service}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/60">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-black text-slate-700 dark:text-slate-200">Sin precios publicados por diseño.</span>{' '}
                  Los servicios Studio se presupuestan según alcance, propiedad, mercado y objetivos.
                  Cada campaña es única. Hablamos.
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
                  href="https://wa.me/34629554870?text=Hola%2C%20me%20interesa%20el%20servicio%20de%20Marketing%20%26%20Performance%20de%20Immersphere%20Studio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]"
                  style={bgStyle}
                >
                  Escribir por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Divider ──────────────────────────────────────────────────── */}
        <div className="my-20 border-t border-slate-100 dark:border-slate-800" />

        {/* ── Gaussian Studio ──────────────────────────────────────────── */}
        <section aria-label="Gaussian Studio — producción premium">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shadow-xl dark:border-slate-700">
            <div className="pointer-events-none absolute inset-0">
              <img
                src="/images/pricing-gaussian-villa.webp"
                alt=""
                className="motion-gaussian-img h-full w-full object-cover opacity-30"
                aria-hidden="true"
              />
            </div>
            {/* Ambient glow overlay — animated via GSAP */}
            <div
              className="motion-gaussian-glow pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                background:
                  'radial-gradient(ellipse at 25% 65%, rgba(124,58,237,0.7) 0%, transparent 52%), radial-gradient(ellipse at 78% 38%, rgba(14,165,233,0.5) 0%, transparent 48%)',
              }}
              aria-hidden="true"
            />
            <div className="px-8 py-12 md:px-12">
              <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">

                {/* Left */}
                <div className="flex-1">
                  <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white/70">
                    Servicio premium
                  </span>
                  <h2 className="motion-section-h2 text-3xl font-black tracking-tight text-white sm:text-4xl">
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

        {/* ── Por qué Immersphere ─────────────────────────────────────── */}
        <section aria-label="Por qué Immersphere" className="mb-20">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="grid lg:grid-cols-2">
              {/* Left: editorial image — visible, split layout */}
              <div className="relative min-h-[320px] overflow-hidden lg:min-h-[480px]">
                <img
                  src="/images/pricing-why-pillar.webp"
                  alt="Agente mostrando tour virtual a clientes en villa de lujo"
                  className="h-full w-full object-cover"
                  style={{ minHeight: '320px' }}
                />
                {/* Subtle right-edge gradient only — image stays visible */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white/60 dark:to-slate-900/60 lg:block hidden" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:hidden" />
                {/* Overlay caption on mobile */}
                <div className="absolute bottom-0 left-0 right-0 p-6 lg:hidden">
                  <p className="text-xs font-black uppercase tracking-widest text-white/70">Por qué Immersphere</p>
                  <h2 className="mt-1 text-2xl font-black text-white">Diseñado para el ritmo real de una agencia.</h2>
                </div>
              </div>
              {/* Right: content */}
              <div className="motion-why-content flex flex-col justify-center p-8 lg:p-12">
                <p className="hidden text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 lg:block">Por qué Immersphere</p>
                <h2 className="mt-2 hidden text-3xl font-black tracking-tight text-slate-900 dark:text-white lg:block">
                  Diseñado para el ritmo real de una agencia.
                </h2>
                <p className="mt-3 hidden text-slate-500 dark:text-slate-400 lg:block">No para demos de feria.</p>
                <div className="mt-8 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
                      <svg className="h-5 w-5 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">Publicado en 5 minutos</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Sube el archivo, configura la propiedad y comparte el link. Sin instalaciones, sin esperar a IT.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40">
                      <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">Leads con contexto real</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Cada lead llega con nombre, teléfono y propiedad visitada. Sabes qué le interesa antes de llamar.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
                      <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white">Tu marca, no la nuestra</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">Desde Pro, el tour lleva tu logo, tu color y tu dominio. El comprador recuerda tu agencia.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section aria-label="Preguntas frecuentes" className="mb-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Preguntas frecuentes</h2>
          </div>
          <div className="mx-auto max-w-3xl divide-y divide-slate-100 rounded-3xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
            {[
              {
                q: '¿El primer mes es realmente gratis en Starter?',
                a: 'Sí. Al activar el plan Starter no se te cobra hasta el segundo mes. Sin tarjeta de crédito bloqueada. Cancela antes de los 30 días y no pagas nada.',
              },
              {
                q: '¿Puedo cambiar de plan en cualquier momento?',
                a: 'Sí. Puedes subir o bajar de plan desde el panel de ajustes. El cambio se aplica al inicio del siguiente ciclo de facturación.',
              },
              {
                q: '¿La producción Gaussian está incluida?',
                a: 'El visor Gaussian está disponible en planes Pro y superiores. La producción (captura, procesado y optimización del modelo 3D) es un servicio separado que se presupuesta bajo diagnóstico. Llama al 629 554 870 para más información.',
              },
              {
                q: '¿Qué pasa si supero el límite de propiedades?',
                a: 'No se desactivan tours publicados. Recibes un aviso en el panel y tienes 7 días para ampliar tu plan o archivar propiedades antes de que se bloquee la creación de nuevas.',
              },
              {
                q: '¿Ofrecéis planes para varias agencias o franquicias?',
                a: 'Sí. El plan Agency cubre hasta 100 propiedades con multiusuario y white-label. Para grupos inmobiliarios o redes de agencias con necesidades avanzadas, hay condiciones Enterprise bajo diagnóstico. Contacta al 629 554 870.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="px-7 py-5">
                <p className="font-black text-slate-900 dark:text-white">{q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{a}</p>
              </div>
            ))}
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
