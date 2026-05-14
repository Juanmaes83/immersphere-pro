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

      {/* ── CÓMO CREAR CONTENIDO 3D ─────────────────────────────── */}
      <section className="bg-slate-50 px-5 py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
            Crea tu contenido
          </p>
          <h2 className="mt-2 text-center text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Cómo crear contenido 3D
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-slate-500 dark:text-slate-400">
            Tres formas de digitalizar tus espacios y objetos
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">

            {/* Tarjeta 1 — Polycam */}
            <article className="flex flex-col rounded-[1.6rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <span className="mb-4 text-3xl">📸</span>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                Escanear un espacio con Polycam
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                App gratuita para iPhone y Android. Escanea habitaciones o edificios enteros.
              </p>
              <ol className="mt-5 space-y-3">
                {([
                  'Descarga Polycam desde la App Store o Google Play',
                  'Abre la app, toca "Scan" y escanea la habitación (2–5 min)',
                  'Exporta el archivo como .splat o .ply desde la app',
                  'Sube el archivo a Immersphere Pro con Drag & Drop',
                ] as const).map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
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
              <div className="mt-auto pt-6">
                <a
                  href="https://poly.cam"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-2xl px-5 py-3 text-center text-sm font-black text-white transition hover:opacity-90"
                  style={bgStyle}
                >
                  Abrir Polycam →
                </a>
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                  Mejor calidad con iPhone 12 Pro o superior (LiDAR). En Android, asegura buena iluminación.
                </p>
              </div>
            </article>

            {/* Tarjeta 2 — Luma AI */}
            <article className="flex flex-col rounded-[1.6rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <span className="mb-4 text-3xl">🤖</span>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                Escanear con IA (Luma AI)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Convierte vídeos en modelos 3D automáticamente. Ideal para Android.
              </p>
              <ol className="mt-5 space-y-3">
                {([
                  'Descarga Luma AI desde la App Store o Google Play',
                  'Graba el espacio dando una vuelta completa (2 min)',
                  'Sube el vídeo a Luma AI y espera el procesamiento',
                  'Descarga el .splat generado y súbelo a Immersphere Pro',
                ] as const).map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
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
              <div className="mt-auto pt-6">
                <a
                  href="https://lumalabs.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-2xl px-5 py-3 text-center text-sm font-black text-white transition hover:opacity-90"
                  style={bgStyle}
                >
                  Abrir Luma AI →
                </a>
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                  Procesamiento en la nube: 5–15 minutos. Recibirás notificación al terminar.
                </p>
              </div>
            </article>

            {/* Tarjeta 3 — Ya tengo el archivo */}
            <article className="flex flex-col rounded-[1.6rem] bg-white p-7 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
              <span className="mb-4 text-3xl">⬆️</span>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">
                Ya tengo el archivo
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Arrastra tu archivo .ply, .splat, .glb o .jpg 360° al formulario.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {(['JPG', 'PNG', 'WEBP', 'PLY', 'SPLAT', 'GLB'] as const).map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  >
                    .{fmt}
                  </span>
                ))}
              </div>
              <div className="mt-auto pt-6">
                {isAuthenticated ? (
                  <Link
                    to="/properties"
                    className="block w-full rounded-2xl px-5 py-3 text-center text-sm font-black text-white transition hover:opacity-90"
                    style={bgStyle}
                  >
                    Ir al panel →
                  </Link>
                ) : (
                  <Link
                    to="/register"
                    className="block w-full rounded-2xl px-5 py-3 text-center text-sm font-black text-white transition hover:opacity-90"
                    style={bgStyle}
                  >
                    Crear cuenta gratis →
                  </Link>
                )}
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                  Tamaño máximo: 100 MB
                </p>
              </div>
            </article>

          </div>
        </div>
      </section>

      {/* ── GUÍA GAUSSIAN SPLAT ─────────────────────────────────── */}
      <section className="bg-white px-5 py-20 dark:bg-slate-950">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-black uppercase tracking-[0.22em]" style={colorStyle}>
            Guía técnica
          </p>
          <h2 className="mt-2 text-center text-3xl font-black text-slate-950 dark:text-white md:text-4xl">
            Gaussian Splats — Todo lo que necesitas saber
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-base text-slate-500 dark:text-slate-400">
            Los Gaussian Splats son la tecnología más avanzada para capturar espacios en 3D volumétrico. Aquí tienes la guía completa.
          </p>

          {/* Qué es */}
          <div className="mt-12 rounded-[1.6rem] bg-gradient-to-br from-violet-950 to-slate-950 p-8 text-white">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">¿Qué es?</p>
            <h3 className="mt-2 text-2xl font-black">Un Gaussian Splat es una nube de puntos 3D fotorrealista</h3>
            <p className="mt-3 text-sm leading-7 text-white/65">
              A diferencia de las fotos 360° (que son planas), los Gaussian Splats capturan el volumen real del espacio:
              puedes moverte por él, ver desde distintos ángulos y apreciar profundidad real.
              Se generan automáticamente desde fotos o vídeo con IA. No hace falta equipo especial.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { icon: '📱', label: 'Captura', desc: 'Vídeo con tu móvil (2 min)' },
                { icon: '☁️', label: 'Procesado', desc: 'IA en la nube (5–15 min)' },
                { icon: '🌐', label: 'Resultado', desc: 'Archivo .splat listo para subir' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="mt-2 text-sm font-black">{item.label}</p>
                  <p className="mt-1 text-xs text-white/50">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Herramientas */}
          <h3 className="mt-12 text-xl font-black text-slate-950 dark:text-white">1. Crea tu Gaussian Splat</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tres herramientas probadas, de más fácil a más avanzada:</p>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[
              {
                name: 'Luma AI',
                badge: 'Recomendado · Gratis',
                badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                icon: '🤖',
                platform: 'iOS · Android · Web',
                steps: [
                  'Descarga la app Luma AI',
                  'Graba un vídeo dando la vuelta completa al espacio (2 min, sin saltos bruscos)',
                  'Sube el vídeo desde la app',
                  'Espera el procesamiento (5–15 min)',
                  'Descarga el archivo .splat desde "Export"',
                ],
                tip: 'Mejor resultado: luz natural, cámara en horizontal, movimiento lento.',
                url: 'https://lumalabs.ai',
              },
              {
                name: 'Polycam',
                badge: 'Muy fácil · Freemium',
                badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                icon: '📸',
                platform: 'iOS · Android',
                steps: [
                  'Descarga Polycam (App Store / Google Play)',
                  'Abre la app y selecciona "Gaussian Splat"',
                  'Escanea el espacio siguiendo las instrucciones (2–5 min)',
                  'Pulsa "Process" y espera',
                  'Exporta como .ply o .splat',
                ],
                tip: 'iPhone 12 Pro o superior: usa LiDAR para máxima precisión.',
                url: 'https://poly.cam',
              },
              {
                name: 'Postshot',
                badge: 'Avanzado · Desktop',
                badgeColor: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                icon: '🖥️',
                platform: 'Windows · macOS',
                steps: [
                  'Descarga Postshot en postshot.app',
                  'Crea un proyecto y sube tus fotos (50–200 fotos del espacio)',
                  'Configura la escena y lanza el entrenamiento (20–60 min, GPU)',
                  'Exporta el resultado como .ply o .splat',
                ],
                tip: 'Mejor calidad. Requiere GPU Nvidia. Ideal para proyectos profesionales.',
                url: 'https://www.jawset.com',
              },
            ].map((tool) => (
              <article key={tool.name} className="flex flex-col rounded-[1.6rem] bg-slate-50 p-6 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{tool.icon}</span>
                  <div>
                    <p className="font-black text-slate-950 dark:text-white">{tool.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-black ${tool.badgeColor}`}>
                      {tool.badge}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-400">{tool.platform}</p>
                <ol className="mt-4 space-y-2.5">
                  {tool.steps.map((step, i) => (
                    <li key={step} className="flex gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white" style={bgStyle}>
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs text-slate-400 dark:bg-slate-800">
                  💡 {tool.tip}
                </p>
                <div className="mt-auto pt-5">
                  <a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded-2xl px-4 py-2.5 text-center text-xs font-black text-white transition hover:opacity-90"
                    style={bgStyle}
                  >
                    Abrir {tool.name} →
                  </a>
                </div>
              </article>
            ))}
          </div>

          {/* Exportar correctamente */}
          <h3 className="mt-12 text-xl font-black text-slate-950 dark:text-white">2. Exporta el archivo correctamente</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { fmt: '.splat', desc: 'Formato más compacto. Compatible con Luma AI y Polycam. Recomendado.', good: true },
              { fmt: '.ply', desc: 'Formato estándar de la comunidad 3DGS. Funciona con todas las herramientas.', good: true },
              { fmt: '.spz', desc: 'Formato comprimido de Niantic/SparkJS. Muy pequeño y rápido de cargar.', good: true },
              { fmt: '.ksplat', desc: 'Formato de GaussianSplats3D. Compatible con SparkJS.', good: true },
            ].map((f) => (
              <div key={f.fmt} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-sm font-black text-slate-950 dark:text-white">{f.fmt}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
                {f.good && (
                  <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    ✓ Soportado
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Subir a Immersphere Pro */}
          <h3 className="mt-12 text-xl font-black text-slate-950 dark:text-white">3. Súbelo a Immersphere Pro</h3>
          <div className="mt-5 rounded-[1.6rem] bg-slate-50 p-7 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Opción A — Desde el panel</p>
                <ol className="mt-4 space-y-3">
                  {[
                    'Crea una propiedad nueva o abre una existente',
                    'En la estancia, pulsa "Añadir asset"',
                    'Selecciona el tipo "Gaussian Splat"',
                    'Sube tu archivo .splat o .ply (máx. 100 MB)',
                    'El visor se activa automáticamente',
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={bgStyle}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Opción B — Desde el visor (temporal)</p>
                <ol className="mt-4 space-y-3">
                  {[
                    'Abre el tour de la propiedad',
                    'Navega a la estancia Gaussian Splat',
                    'En el panel lateral, pulsa "Subir .ply / .splat / .sog"',
                    'Selecciona tu archivo local',
                    'El visor carga el splat al instante (sin subida al servidor)',
                  ].map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={bgStyle}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  ⚠️ La opción B es solo para previsualización local. Para compartir el tour con clientes, usa la opción A.
                </p>
              </div>
            </div>
          </div>

          {/* Solución de problemas */}
          <h3 className="mt-12 text-xl font-black text-slate-950 dark:text-white">4. Solución de problemas</h3>
          <div className="mt-5 space-y-3">
            {[
              {
                prob: 'El splat no se ve / "Splat no disponible"',
                sol: 'Si usas una URL externa, puede que el servidor no permita carga desde otros dominios (CORS). Usa siempre la opción de subir el archivo directamente desde tu ordenador. Los archivos subidos desde tu dispositivo siempre funcionan.',
              },
              {
                prob: 'El archivo tarda mucho en cargar',
                sol: 'Los archivos .ply sin comprimir pueden pesar 200 MB+. Usa SuperSplat (superspl.at/editor) para comprimir y limpiar el splat antes de subirlo. El formato .spz es el más compacto.',
              },
              {
                prob: 'El splat se ve borroso o con ruido',
                sol: 'La calidad depende de la captura. Más fotos = más calidad. Asegura buena iluminación uniforme (evita luz directa solar). Usa un trípode si es posible. En Postshot, aumenta las iteraciones de entrenamiento.',
              },
              {
                prob: 'El editor (zonas ocultadas) no funciona',
                sol: 'El editor SDF solo está disponible cuando el splat está completamente cargado (botón "Seleccionar gaussianas" activo). Si el splat no ha cargado, espera o sube un nuevo archivo.',
              },
              {
                prob: 'Quiero limpiar partes no deseadas (suelo, paredes)',
                sol: 'Usa SuperSplat (superspl.at/editor): es un editor profesional gratuito. Abre tu .splat, selecciona y borra las gaussianas no deseadas con las herramientas de selección, y exporta el resultado. Luego vuélvelo a subir a Immersphere Pro.',
              },
            ].map((item) => (
              <div key={item.prob} className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                <p className="text-sm font-black text-slate-900 dark:text-white">❓ {item.prob}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">✅ {item.sol}</p>
              </div>
            ))}
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
