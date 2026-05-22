import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';
import { M, loadGSAP } from '@/lib/motion';

// ── Buyer Tools Mockup — pure JSX, no image needed ───────────────────────────

function BuyerToolsMockup({ primaryColor }: { primaryColor: string }): JSX.Element {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-violet-950/40 backdrop-blur-sm">
      <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-xl">
        {/* Property header strip */}
        <div className="relative h-28 overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
          <img
            src="/images/pricing-gaussian-villa.webp"
            alt=""
            className="h-full w-full object-cover opacity-60"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70" style={{ color: primaryColor }}>
              Tour inmersivo
            </p>
            <p className="text-base font-black text-white leading-tight">Ático Lumière · Madrid</p>
          </div>
        </div>

        {/* Mortgage simulator */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0" style={{ color: primaryColor }} aria-hidden="true">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: primaryColor }}>
              Simulador de hipoteca
            </p>
          </div>
          <div className="rounded-xl py-2.5 text-center" style={{ backgroundColor: `${primaryColor}14` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: primaryColor }}>Cuota mensual estimada</p>
            <p className="mt-0.5 text-2xl font-black text-slate-950">1.284 €<span className="ml-1 text-xs font-bold text-slate-400">/mes</span></p>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between text-[10px]">
              <span className="font-bold text-slate-400">Entrada 20%</span>
              <span className="font-black text-slate-700">64.000 €</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full" style={{ width: '40%', backgroundColor: primaryColor }} />
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="font-bold text-slate-400">Plazo 30 años · 3,5%</span>
              <span className="font-black text-slate-700">Tipo fijo</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full" style={{ width: '75%', backgroundColor: primaryColor }} />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-5 pb-5 space-y-2">
          {/* Calendly */}
          <div className="flex items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-black text-white" style={{ backgroundColor: '#0069FF' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            📅 Reservar visita
          </div>
          {/* PDF */}
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-xs font-black text-slate-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Descargar ficha PDF
          </div>
          <p className="text-center text-[9px] text-slate-300 pt-0.5">
            📝 Cálculo orientativo. Consulta condiciones reales con tu banco.
          </p>
        </div>
      </div>
    </div>
  );
}

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
          src="/images/pricing-gaussian-villa.webp"
          alt=""
          className="h-28 w-full object-cover opacity-75"
          loading="lazy"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
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
      <div className="mt-5 flex flex-col gap-1.5">
        {[
          { emoji: '💳', label: 'Simula la hipoteca', color: 'text-violet-300' },
          { emoji: '📅', label: 'Reserva visita', color: 'text-blue-300' },
          { emoji: '📄', label: 'Descarga la ficha PDF', color: 'text-emerald-300' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2.5 rounded-lg bg-white/[0.07] px-3 py-2">
            <span className="text-sm">{item.emoji}</span>
            <span className={`text-xs font-bold ${item.color}`}>{item.label}</span>
          </div>
        ))}
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
      <div className="mt-5 flex items-center gap-4 rounded-xl bg-white/[0.07] px-4 py-3">
        {/* QR placeholder */}
        <div className="h-14 w-14 shrink-0 rounded-lg bg-white p-1.5">
          <div className="grid h-full grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-[1px] ${[0,2,4,6,8].includes(i) ? 'bg-slate-900' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">SCAN</p>
          <p className="mt-0.5 text-xs text-white/60">Descarga · Imprime · Comparte</p>
          <p className="mt-1 text-[10px] text-white/35">PNG listo en un clic</p>
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
  const { color, bgStyle, colorStyle } = useBrand();
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

        {/* Right — Buyer tools mockup */}
        <div className="motion-land-mockup hidden lg:block">
          <BuyerToolsMockup primaryColor={color} />
        </div>
      </section>

      {/* ── TRUST STRIP ───────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.07] bg-white/[0.03] py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5">
          {[
            { icon: '⚡', text: 'Tour online en 5 minutos' },
            { icon: '📱', text: 'Abre en cualquier móvil' },
            { icon: '🔒', text: 'Tours con contraseña opcional' },
            { icon: '🌐', text: 'Iframe embebible en tu web' },
            { icon: '📊', text: 'Analytics de comportamiento' },
          ].map(({ icon, text }) => (
            <span key={text} className="flex items-center gap-2 text-xs font-bold text-white/45">
              <span>{icon}</span>
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
            {/* Background image */}
            <div className="absolute inset-0">
              <img
                src="/images/pricing-gaussian-villa.webp"
                alt=""
                className="h-full w-full object-cover opacity-20"
                aria-hidden="true"
                loading="lazy"
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
                ✦ Exclusivo Pro y Agency
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
        <div className="rounded-[2rem] bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 px-8 py-16 text-center shadow-2xl shadow-violet-950/60 md:px-12 md:py-20">
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
      </section>

    </main>
  );
}
