import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';

type SectorId = 'inmobiliarias' | 'constructoras' | 'decoradores' | 'museos';

const STEPS = [
  {
    icon: '📸',
    label: 'Captura',
    title: 'Haz la foto en 5 minutos',
    body: 'Usa Google Street View (gratis, iOS y Android): abre la app, toca "Crear" → "Foto esférica" y gira sobre ti mismo. O graba un vídeo de 2 minutos y conviértelo en 3D con Luma AI.',
    note: 'Formatos: JPG · PNG · WEBP · PLY · SPLAT',
  },
  {
    icon: '⬆️',
    label: 'Sube',
    title: 'Arrastra tu archivo al panel',
    body: 'Entra en tu panel, crea una propiedad y sube el archivo. Sin programas. Sin complicaciones. Tu tour está listo en menos de un minuto.',
    note: 'Tamaño máximo: 100 MB',
  },
  {
    icon: '🚀',
    label: 'Publica',
    title: 'Comparte con un clic',
    body: 'Tu tour está online al instante. Comparte el link por WhatsApp, email o QR. Tus clientes lo ven desde el móvil sin instalar nada.',
    note: 'Funciona en Chrome · Safari · Edge',
  },
] as const;

const SECTORS: Array<{
  id: SectorId;
  icon: string;
  label: string;
  benefits: string[];
  steps: string[];
}> = [
  {
    id: 'inmobiliarias',
    icon: '🏠',
    label: 'Inmobiliarias',
    benefits: [
      'Tus clientes visitan el piso desde el sofá. Sin desplazamientos innecesarios.',
      'Capturas leads automáticamente mientras duermes.',
      'Sabes qué habitaciones interesan más gracias a analytics por estancia.',
      'Compartes por WhatsApp, email, QR o iframe embebido en tu web.',
    ],
    steps: [
      'Haz una foto 360° con Google Street View (5 min)',
      'Súbela a Immersphere Pro (1 min)',
      'Añade hotspots: "Contactar agente", "15 m²", "Vistas al mar"',
      'Publica y comparte el link',
    ],
  },
  {
    id: 'constructoras',
    icon: '🏗️',
    label: 'Constructoras',
    benefits: [
      'Vendes sobre plano con renders 360° antes de que exista el edificio.',
      'El comprador pasea por la obra terminada en 3D volumétrico.',
      'Hotspots con precio, m², fecha de entrega y calidades de acabado.',
      'Comparador de tipologías (A, B, C) lado a lado en la misma pantalla.',
    ],
    steps: [
      'Renderiza tu proyecto en 360° (3ds Max, Blender, SketchUp)',
      'O graba un vídeo de la obra y conviértelo con Luma AI',
      'Súbelo a Immersphere Pro',
      'Añade hotspots con datos comerciales: precio, m², entrega',
    ],
  },
  {
    id: 'decoradores',
    icon: '🛋️',
    label: 'Decoradores',
    benefits: [
      'Portfolio inmersivo que impacta más que Instagram.',
      'Antes vs. Después con un clic (dos espacios en la misma propiedad).',
      'Cada mueble con su ficha: fabricante, precio, link de compra.',
      'El cliente te contrata desde el tour — lead capture integrado.',
    ],
    steps: [
      'Haz fotos 360° del espacio vacío y del espacio decorado',
      'Súbelas como 2 espacios: "Antes" y "Después"',
      'Añade hotspots con ficha de cada mueble',
      'Comparte tu portfolio con clientes potenciales',
    ],
  },
  {
    id: 'museos',
    icon: '🏛️',
    label: 'Museos',
    benefits: [
      'Visitas virtuales con textos históricos en cada obra.',
      'Tour guiado automático por todas las salas.',
      'QR en la entrada física para que los visitantes profundicen.',
      'Analytics: qué obras generan más interés y tiempo de atención.',
    ],
    steps: [
      'Haz una foto 360° en cada sala (trípode recomendado)',
      'Súbelas como espacios independientes',
      'Añade hotspots tipo INFO con texto histórico',
      'Activa el Tour guiado automático',
      'Publica y comparte el QR en la entrada',
    ],
  },
];

const BEFORE_AFTER = [
  ['Fotos estáticas que no convencen', 'Tour 360° interactivo que engancha desde el primer segundo'],
  ['Visitas físicas innecesarias que cuestan tiempo y dinero', 'Clientes que ya conocen el espacio antes de llamarte'],
  ['Leads perdidos porque no hay formulario de contacto', 'Leads capturados automáticamente 24/7'],
  ['Sin datos de qué habitaciones o piezas interesan', 'Analytics por estancia, obra o sala en tiempo real'],
  ['Dependes de apps de terceros con su marca', 'Todo en una plataforma con tu logo y colores'],
] as const;

const FAQS = [
  {
    q: '¿Necesito instalar algo?',
    a: 'No. Todo funciona desde el navegador (Chrome, Safari, Edge). Ni tú ni tus clientes necesitáis instalar ninguna app.',
  },
  {
    q: '¿Necesito una cámara especial?',
    a: 'No. Tu móvil con Google Street View (gratis) es suficiente para empezar. Para proyectos más exigentes, cualquier cámara 360° tipo Ricoh Theta o Insta360 funciona perfectamente.',
  },
  {
    q: '¿Qué app uso para hacer fotos 360°?',
    a: 'Google Street View (gratis, iOS y Android). Abre la app, toca "Crear" → "Foto esférica" y gira sobre ti mismo siguiendo los puntos. En 5 minutos tienes tu foto lista para subir.',
  },
  {
    q: '¿Cómo convierto un vídeo en 3D?',
    a: 'Usa Luma AI (gratuito). Graba un vídeo de 2–3 minutos dando la vuelta al espacio, súbelo a la app y en unos minutos descarga el archivo .ply o .splat listo para Immersphere Pro.',
  },
  {
    q: '¿Puedo personalizar los colores con mi marca?',
    a: 'Sí. El plan PROFESSIONAL incluye personalización completa: tu logo, tus colores corporativos y tu dominio. Tus clientes ven tu marca, no la nuestra.',
  },
  {
    q: '¿Cuánto tardo en publicar mi primer tour?',
    a: '5 minutos desde que tienes la foto. Crear la propiedad, subir el archivo y publicar es un proceso de 3 pasos sin complicaciones técnicas.',
  },
  {
    q: '¿Mis clientes necesitan descargar alguna app?',
    a: 'No. Solo necesitan el link que les mandas. Funciona en móvil, tablet y PC directamente desde el navegador.',
  },
  {
    q: '¿Qué planes hay y cuánto cuestan?',
    a: 'Starter (0 €/mes, hasta 10 propiedades), Professional (49 €/mes, hasta 50 propiedades), Enterprise (199 €/mes, propiedades ilimitadas + white label + soporte prioritario). Todos incluyen visor 360°, analytics y lead capture.',
  },
] as const;

export default function HelpPage(): JSX.Element {
  const [activeSector, setActiveSector] = useState<SectorId>('inmobiliarias');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { bgStyle, colorStyle } = useBrand();
  const isAuthenticated = useAuthStore((state) => !!state.user);

  const sector = SECTORS.find((s) => s.id === activeSector) ?? SECTORS[0];

  return (
    <main>
      <Helmet>
        <title>Ayuda y guía rápida | Immersphere Pro</title>
        <meta
          name="description"
          content="Crea tours virtuales 360° en 5 minutos. Guía paso a paso para inmobiliarias, constructoras, decoradores y museos."
        />
      </Helmet>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 px-5 py-24 text-white md:py-32">
        <div className="relative mx-auto max-w-3xl text-center">
          <span
            className="mb-6 inline-block rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em]"
            style={{ ...bgStyle, opacity: 0.9 }}
          >
            Immersphere Pro · Guía rápida
          </span>
          <h1 className="text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">
            Convierte tus espacios en{' '}
            <span style={colorStyle}>experiencias que venden</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/60 md:text-xl">
            Tours virtuales 360° y 3D en minutos. Desde tu móvil. Sin instalar nada.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isAuthenticated ? (
              <Link
                to="/properties"
                className="rounded-full px-8 py-3.5 text-sm font-black text-white transition hover:opacity-90"
                style={bgStyle}
              >
                Ir a mis propiedades →
              </Link>
            ) : (
              <Link
                to="/register"
                className="rounded-full px-8 py-3.5 text-sm font-black text-white transition hover:opacity-90"
                style={bgStyle}
              >
                Crear cuenta gratis →
              </Link>
            )}
            <Link
              to="/gallery"
              className="rounded-full border border-white/20 px-8 py-3.5 text-sm font-black text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Ver ejemplos en vivo
            </Link>
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ───────────────────────────────────────── */}
      <section className="bg-slate-50 px-5 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
            Cómo funciona
          </p>
          <h2 className="mt-2 text-center text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Tres pasos. Sin complicaciones.
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <article
                key={step.label}
                className="rounded-[1.6rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white"
                    style={bgStyle}
                  >
                    {i + 1}
                  </span>
                  <span className="text-2xl">{step.icon}</span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    {step.label}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-950 dark:text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{step.body}</p>
                <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                  {step.note}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUÍA POR SECTOR ─────────────────────────────────────── */}
      <section className="bg-white px-5 py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
            Guía por sector
          </p>
          <h2 className="mt-2 text-center text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Hecho para tu negocio
          </h2>

          {/* Tabs */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {SECTORS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSector(s.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-black transition ${
                  activeSector === s.id
                    ? 'text-white shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
                style={activeSector === s.id ? bgStyle : undefined}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Sector content */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Benefits */}
            <div className="rounded-[1.6rem] bg-slate-50 p-7 dark:bg-slate-900">
              <p className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Por qué te conviene
              </p>
              <ul className="space-y-4">
                {sector.benefits.map((b) => (
                  <li key={b} className="flex gap-3 text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                      style={bgStyle}
                    >
                      ✓
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div className="rounded-[1.6rem] bg-slate-50 p-7 dark:bg-slate-900">
              <p className="mb-5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Cómo se hace
              </p>
              <ol className="space-y-4">
                {sector.steps.map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                      style={bgStyle}
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANTES vs AHORA ──────────────────────────────────────── */}
      <section className="bg-slate-50 px-5 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
            El cambio real
          </p>
          <h2 className="mt-2 text-center text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Antes vs. Ahora
          </h2>

          <div className="mt-10 overflow-hidden rounded-[1.6rem] ring-1 ring-slate-200 dark:ring-slate-700">
            {/* Header */}
            <div className="grid grid-cols-2">
              <div className="bg-slate-200 px-6 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                ✗ Sin Immersphere
              </div>
              <div
                className="px-6 py-4 text-center text-xs font-black uppercase tracking-[0.18em] text-white"
                style={bgStyle}
              >
                ✓ Con Immersphere
              </div>
            </div>

            {/* Rows */}
            {BEFORE_AFTER.map(([before, after], i) => (
              <div
                key={before}
                className={`grid grid-cols-2 ${i % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900'}`}
              >
                <div className="flex items-start gap-3 border-r border-slate-100 px-6 py-5 dark:border-slate-800">
                  <span className="mt-0.5 shrink-0 text-xs font-black text-red-400">✗</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{before}</span>
                </div>
                <div className="flex items-start gap-3 px-6 py-5">
                  <span className="mt-0.5 shrink-0 text-xs font-black text-emerald-500">✓</span>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{after}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="bg-white px-5 py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
            Preguntas frecuentes
          </p>
          <h2 className="mt-2 text-center text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Todo lo que necesitas saber
          </h2>

          <div className="mt-10 space-y-2">
            {FAQS.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={faq.q}
                  className="overflow-hidden rounded-2xl ring-1 ring-slate-200 transition dark:ring-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-sm font-black text-slate-900 dark:text-white">{faq.q}</span>
                    <span
                      className={`shrink-0 text-lg font-black transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`}
                      style={colorStyle}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-6 pb-5 pt-4 dark:border-slate-800">
                      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 px-5 py-24 text-center text-white md:py-32">
        <p className="text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
          Empieza hoy
        </p>
        <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
          Tu primer tour en 5 minutos
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-white/55">
          Plan Starter gratuito. Sin tarjeta. Sin compromiso.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link
              to="/properties"
              className="rounded-full px-10 py-4 text-base font-black text-white shadow-lg transition hover:opacity-90"
              style={bgStyle}
            >
              Crear mi primera propiedad →
            </Link>
          ) : (
            <>
              <Link
                to="/register"
                className="rounded-full px-10 py-4 text-base font-black text-white shadow-lg transition hover:opacity-90"
                style={bgStyle}
              >
                Crear cuenta gratis →
              </Link>
              <Link
                to="/login"
                className="rounded-full border border-white/20 px-8 py-4 text-sm font-black text-white/70 transition hover:border-white/40 hover:text-white"
              >
                Ya tengo cuenta
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
