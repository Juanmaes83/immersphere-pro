import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';
import { M, loadGSAP } from '@/lib/motion';

// ── CDN image map ─────────────────────────────────────────────────────────────

const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/';

const IMG = {
  /** MacBook Pro with SaaS UI — hero right column */
  heroMacbook:  `${CDN}hf_20260522_132621_780ebefa-1d2d-4839-877d-8d51858e2f9e_min.webp`,
  /** Agent in luxury kitchen holding tablet — Pillar 1 */
  agentTablet:  `${CDN}hf_20260522_132608_1850e982-8dbf-46f6-97f5-01f93a691232_min.webp`,
  /** Agent in kitchen with tablet v2 — Pillar 3 */
  agentTablet2: `${CDN}hf_20260522_132611_c18ac9ef-e10e-4dc4-abd5-ffce69b182d3_min.webp`,
  /** Couple looking at iPad — Pillar 2 */
  coupleIpad:   `${CDN}hf_20260522_132615_08bc6a7d-dc65-4af6-8fa2-8777c8d97829_min.webp`,
  /** Luxury living room + SaaS UI overlay — AR banner bg */
  livingRoomUi: `${CDN}hf_20260522_132618_533e71ba-56e5-460a-9b21-9dc3b51aa362_min.webp`,
  /** Villa magic-hour dusk — Final CTA bg */
  villaDusk:    `${CDN}hf_20260522_132626_aa68d171-d7a0-416c-bcf1-4375eeb6ce71_min.webp`,
} as const;

// ── Feature pillars data ──────────────────────────────────────────────────────

const PILLARS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    iconBg: 'bg-violet-500/20',
    iconColor: 'text-violet-300',
    title: 'El piso que no necesita visita',
    body: '360° panorámico o Gaussian Splat 3D. Sin app. Sin descarga. Abre en cualquier móvil en segundos. El comprador lo explora a su ritmo, en su sofá, a las 11 de la noche.',
    visual: (
      <div className="relative mt-5 overflow-hidden rounded-xl">
        <img
          src={IMG.agentTablet}
          alt="Agente inmobiliaria mostrando tour 360° en tablet en cocina de lujo"
          className="h-32 w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-black text-white/90">Abre en el navegador · Sin descargar nada</span>
        </div>
      </div>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-300',
    title: 'El comprador que ya viene decidido',
    body: 'Simulador de hipoteca integrado. Botón de reserva directa con Calendly. Ficha PDF con QR del tour. El comprador simula, reserva y se lleva la ficha — sin salir de tu URL.',
    visual: (
      <div className="relative mt-5 overflow-hidden rounded-xl">
        <img
          src={IMG.coupleIpad}
          alt="Pareja compradora revisando propiedad en iPad con entusiasmo"
          className="h-32 w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-3 flex flex-col gap-0.5">
          {[
            { label: 'Simulador de hipoteca', color: 'text-violet-300' },
            { label: 'Reserva visita · Descarga PDF', color: 'text-emerald-300' },
          ].map((item) => (
            <span key={item.label} className={`text-[10px] font-black ${item.color}`}>{item.label}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9M3 15h6M15 15h6M15 9v12" />
      </svg>
    ),
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-300',
    title: 'Tu tour en el escaparate',
    body: 'QR descargable en PNG. En el cartel de la propiedad, en el escaparate, en tu tarjeta de visita. Los compradores abren el tour desde la calle. Sin teclear una URL.',
    visual: (
      <div className="relative mt-5 overflow-hidden rounded-xl">
        <img
          src={IMG.agentTablet2}
          alt="Agente inmobiliaria mostrando QR del tour en tablet en cocina de lujo"
          className="h-32 w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-2.5">
          {/* QR mini */}
          <div className="h-10 w-10 shrink-0 rounded-md bg-white p-1">
            <div className="grid h-full grid-cols-3 gap-[1px]">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className={`rounded-[1px] ${[0,2,4,6,8].includes(i) ? 'bg-slate-900' : 'bg-slate-200'}`} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">SCAN</p>
            <p className="mt-0.5 text-[9px] text-white/60">PNG listo en un clic</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    iconBg: 'bg-sky-500/20',
    iconColor: 'text-sky-300',
    title: 'Sabes quién va a llamar antes de que llame',
    body: 'Engagement score por propiedad. Habitación más visitada. Hotspot más clicado. Leads en tiempo real. Dashboard con las 5 propiedades más vistas esta semana.',
    visual: (
      <div className="mt-5 space-y-2">
        {[
          { label: 'Salón principal', pct: 84, color: '#818cf8' },
          { label: 'Terraza', pct: 61, color: '#34d399' },
          { label: 'Cocina reformada', pct: 38, color: '#fbbf24' },
        ].map(({ label, pct, color }) => (
          <div key={label}>
            <div className="flex justify-between text-[10px] text-white/50 mb-0.5">
              <span>{label}</span>
              <span className="font-black text-white/80">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
] as const;

// ── Why Immersphere reasons ───────────────────────────────────────────────────

const WHY_REASONS = [
  {
    number: '01',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    title: 'Publicado en 5 minutos',
    body: 'Sube el archivo, configura la propiedad y comparte el link. Sin instalaciones, sin esperar a IT, sin reuniones de configuración. Funciona desde el primer día.',
  },
  {
    number: '02',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: 'El comprador actúa desde el tour',
    body: 'Simula la hipoteca, reserva visita con Calendly y descarga la ficha PDF. Menos llamadas de descarte. Más visitas con intención real de compra.',
  },
  {
    number: '03',
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    title: 'Tu marca, no la nuestra',
    body: 'Logo, color corporativo y dominio de tu agencia desde el plan Pro. El comprador recuerda tu nombre, no el nuestro. Así es como se construye reputación de agencia.',
  },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage(): JSX.Element {
  const { bgStyle, colorStyle } = useBrand();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;

    loadGSAP().then(({ gsap, ScrollTrigger, SplitText }) => {
      if (!mainRef.current) return;
      ctx = gsap.context(() => {

        // Hero badge
        gsap.from('.motion-land-badge', {
          y: 16, opacity: 0, duration: M.base, ease: M.ease, delay: 0.1,
        });

        // Hero headline — SplitText line reveal
        const h1 = mainRef.current?.querySelector('.motion-land-h1');
        if (h1) {
          const split = new SplitText(h1, { type: 'lines', linesClass: 'overflow-hidden' });
          gsap.from(split.lines, {
            y: '105%', opacity: 0, duration: M.cinematic,
            stagger: M.stagger, ease: M.easeBack, delay: 0.2,
          });
        }

        // Hero sub + CTA
        gsap.from('.motion-land-sub', { y: 14, opacity: 0, duration: M.base, ease: M.ease, delay: 0.55 });
        gsap.from('.motion-land-cta', { y: 12, opacity: 0, duration: M.base, ease: M.ease, delay: 0.72 });
        gsap.from('.motion-land-chips', { y: 10, opacity: 0, duration: M.base, ease: M.ease, delay: 0.85 });

        // Hero mockup — scale in from right
        gsap.from('.motion-land-mockup', {
          x: 30, opacity: 0, duration: M.slow, ease: M.ease, delay: 0.45,
        });

        // Pillar cards — stagger on scroll
        gsap.set('.motion-land-pillar', { y: 36, opacity: 0 });
        ScrollTrigger.batch('.motion-land-pillar', {
          onEnter: (els) => gsap.to(els, {
            y: 0, opacity: 1, duration: M.base, stagger: M.stagger, ease: M.ease,
          }),
          start: M.scrollStart, once: true,
        });

        // AR banner — fade in
        gsap.from('.motion-land-ar', {
          y: 24, opacity: 0, duration: M.base, ease: M.ease,
          scrollTrigger: { trigger: '.motion-land-ar', start: 'top 80%', once: true },
        });

        // AR image parallax
        ScrollTrigger.create({
          trigger: '.motion-land-ar-img',
          start: 'top bottom', end: 'bottom top', scrub: 1.2,
          onUpdate: (self) => {
            gsap.set('.motion-land-ar-img img', { y: self.progress * -30 });
          },
        });

        // Why reasons — stagger from left
        gsap.set('.motion-land-why', { x: -20, opacity: 0 });
        ScrollTrigger.batch('.motion-land-why', {
          onEnter: (els) => gsap.to(els, {
            x: 0, opacity: 1, duration: M.base, stagger: M.staggerFast, ease: M.ease,
          }),
          start: 'top 85%', once: true,
        });

        // Section headings
        gsap.utils.toArray<Element>('.motion-land-h2').forEach((el) => {
          gsap.from(el, {
            y: 22, opacity: 0, duration: M.base, ease: M.ease,
            scrollTrigger: { trigger: el, start: M.scrollStart, once: true },
          });
        });

      }, mainRef);
    });

    return () => { ctx?.revert(); };
  }, []);

  return (
    <main ref={mainRef} className="bg-[#050712] text-white">
      <Helmet>
        <title>Immersphere Pro · Tours inmersivos para inmobiliarias</title>
        <meta
          name="description"
          content="El comprador ve el piso, simula la hipoteca y reserva visita — desde tu URL. Tours 360° y 3D para inmobiliarias. Sin app. Sin instalación."
        />
        <meta property="og:title" content="Immersphere Pro · Tours inmersivos para inmobiliarias" />
        <meta property="og:description" content="El comprador ve el piso, simula la hipoteca y reserva visita — desde tu URL. Tours 360° y 3D para inmobiliarias." />
        <meta property="og:image" content={IMG.livingRoomUi} />
        <meta property="og:image:width" content="2752" />
        <meta property="og:image:height" content="1536" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={IMG.livingRoomUi} />
      </Helmet>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl grid-cols-1 items-center gap-10 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-0">

        {/* Left — Copy */}
        <div>
          <span
            className="motion-land-badge mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white/75 backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            SaaS inmobiliario · Activo desde el día 1
          </span>

          <h1 className="motion-land-h1 max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.04em] md:text-6xl lg:text-7xl">
            El comprador ve el piso,{' '}
            <span style={colorStyle}>simula la hipoteca</span>
            {' '}y reserva visita.
          </h1>

          <p className="motion-land-sub mt-6 max-w-lg text-lg leading-8 text-white/55 md:text-xl">
            Tours inmersivos 360° y 3D con herramientas de comprador integradas.
            El agente publica en 5 minutos. El comprador decide sin visitar.
          </p>

          <div className="motion-land-cta mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/register"
              className="rounded-full px-8 py-4 text-center text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]"
              style={bgStyle}
            >
              Crear cuenta gratis →
            </Link>
            <Link
              to="/gallery"
              className="rounded-full border border-white/15 px-8 py-4 text-center text-sm font-black text-white/70 transition hover:border-white/35 hover:text-white active:scale-[0.98]"
            >
              Ver tours en vivo
            </Link>
          </div>

          <div className="motion-land-chips mt-6 flex flex-wrap gap-2">
            {[
              '1er mes gratis',
              'Sin app · Sin instalación',
              'Cancela cuando quieras',
            ].map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-bold text-white/60"
              >
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                {chip}
              </span>
            ))}
          </div>
        </div>

        {/* Right — MacBook product shot */}
        <div className="motion-land-mockup hidden lg:block">
          <div className="relative overflow-hidden rounded-[2rem] shadow-2xl shadow-violet-950/60 ring-1 ring-white/10">
            <img
              src={IMG.heroMacbook}
              alt="Plataforma Immersphere Pro en MacBook — tour inmersivo 360° con panel de analytics en salón de lujo"
              className="w-full object-cover"
              loading="eager"
              width={2752}
              height={1536}
            />
            {/* Subtle violet tint overlay to blend with dark bg */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-violet-950/30 via-transparent to-transparent" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ───────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.07] bg-white/[0.03] py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5">
          {([
            {
              text: 'Tour online en 5 minutos',
              svg: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              ),
            },
            {
              text: 'Abre en cualquier móvil',
              svg: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ),
            },
            {
              text: 'Tours con contraseña opcional',
              svg: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              ),
            },
            {
              text: 'Iframe embebible en tu web',
              svg: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ),
            },
            {
              text: 'Analytics de comportamiento',
              svg: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ),
            },
          ] as { text: string; svg: JSX.Element }[]).map(({ svg, text }) => (
            <span key={text} className="flex items-center gap-2 text-xs font-bold text-white/45">
              {svg}
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* ── FEATURE PILLARS ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="mb-14 text-center">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-400">
            Todo incluido en tu plan
          </p>
          <h2 className="motion-land-h2 mt-4 text-4xl font-black tracking-tight md:text-5xl">
            El tour que vende.
            <br />
            <span className="text-violet-300">Y los datos que convencen.</span>
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => (
            <article
              key={i}
              className="motion-land-pillar rounded-[1.6rem] border border-white/[0.08] bg-white/[0.04] p-7 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/[0.07]"
            >
              <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${pillar.iconBg} ${pillar.iconColor}`}>
                {pillar.icon}
              </div>
              <h3 className="text-xl font-black tracking-tight text-white">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-7 text-white/55">{pillar.body}</p>
              {pillar.visual}
            </article>
          ))}
        </div>
      </section>

      {/* ── AR BANNER ─────────────────────────────────────────────────── */}
      <section className="motion-land-ar px-5 pb-24">
        <div className="mx-auto max-w-7xl">
          <div className="motion-land-ar-img relative overflow-hidden rounded-[2rem] border border-violet-400/15">
            {/* Background image — luxury living room with SaaS UI overlay */}
            <div className="absolute inset-0">
              <img
                src={IMG.livingRoomUi}
                alt=""
                className="h-full w-full object-cover opacity-30"
                aria-hidden="true"
                loading="lazy"
                width={2752}
                height={1536}
              />
            </div>
            {/* Glow */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 20% 60%, rgba(124,58,237,0.5) 0%, transparent 55%), radial-gradient(ellipse at 80% 40%, rgba(99,102,241,0.3) 0%, transparent 50%)',
              }}
              aria-hidden="true"
            />
            {/* Content */}
            <div className="relative px-8 py-16 text-center md:px-16 md:py-20">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                  <path d="M12 2l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 11l-3.75 2.75 1.5-4.5L6 6.5h4.5z" />
                </svg>
                Exclusivo Pro y Agency
              </span>
              <h2 className="motion-land-h2 mx-auto max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
                Activa la cámara.
                <br />
                <span className="text-violet-300">El piso aparece en tu salón.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-white/55">
                Realidad Aumentada integrada en el visor. Sin app. Sin descarga.
                El comprador lo ve en su espacio real antes de visitarlo.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/pricing"
                  className="rounded-full bg-violet-500 px-8 py-3.5 text-sm font-black text-white transition hover:bg-violet-400 active:scale-[0.98]"
                >
                  Ver planes con AR →
                </Link>
                <Link
                  to="/register"
                  className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-black text-white/70 transition hover:border-white/40 hover:text-white active:scale-[0.98]"
                >
                  Empezar gratis
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── POR QUÉ IMMERSPHERE ───────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <div className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.03]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">

            {/* Left — Headline */}
            <div className="border-b border-white/[0.08] px-8 py-12 lg:border-b-0 lg:border-r lg:px-12 lg:py-16">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-400">
                Por qué Immersphere
              </p>
              <h2 className="motion-land-h2 mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Diseñado para el ritmo real de una agencia.
                <br />
                <span className="text-white/35">No para demos de feria.</span>
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/45">
                Cada feature existe porque un agente la necesitó. No porque quedase bien en una presentación de inversores.
              </p>
              <div className="mt-8">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-black text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Ver planes →
                </Link>
              </div>
            </div>

            {/* Right — Reasons */}
            <div className="divide-y divide-white/[0.08]">
              {WHY_REASONS.map((reason) => (
                <div key={reason.number} className="motion-land-why flex items-start gap-5 px-8 py-8 lg:px-10">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <span className="text-xs font-black tabular-nums text-white/20">{reason.number}</span>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-violet-300">
                      {reason.icon}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-white">{reason.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/50">{reason.body}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-[2rem] px-8 py-16 text-center shadow-2xl shadow-violet-950/60 md:px-12 md:py-20">
          {/* Villa dusk background */}
          <div className="absolute inset-0">
            <img
              src={IMG.villaDusk}
              alt=""
              className="h-full w-full object-cover"
              aria-hidden="true"
              loading="lazy"
              width={2752}
              height={1536}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/90 via-violet-800/85 to-indigo-900/90" />
          </div>
          {/* Content */}
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-200/70">
              Empieza hoy
            </p>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">
              Tu primer tour esta tarde.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-violet-100/70">
              Plan Starter gratuito el primer mes. Sin tarjeta. Sin compromiso.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/register"
                className="rounded-full bg-white px-10 py-4 text-base font-black text-violet-700 shadow-lg transition hover:bg-violet-50 active:scale-[0.98]"
              >
                Crear cuenta gratis →
              </Link>
              <Link
                to="/pricing"
                className="rounded-full border border-white/25 px-8 py-4 text-sm font-black text-white/80 transition hover:border-white/50 hover:text-white active:scale-[0.98]"
              >
                Ver todos los planes
              </Link>
            </div>
            <p className="mt-6 text-xs font-bold text-violet-200/50">
              Sin tarjeta de crédito · Cancela cuando quieras · Soporte incluido
            </p>
          </div>
        </div>
      </section>

    </main>
  );
}
