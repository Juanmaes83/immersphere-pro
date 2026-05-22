import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import RegisterForm from '@/components/auth/RegisterForm';

// CDN images
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_32tIBn1VWPFRvRlTsdl6JD8uoae/';
const BG_IMG = `${CDN}hf_20260519_071439_c326a27b-7139-4e2a-9a23-0f498086c353.png`;

const BENEFITS = [
  { text: 'Sube una foto 360° y publica en minutos' },
  { text: 'Hotspots, planos y leads totalmente integrados' },
  { text: 'Embed en tu web o comparte con un link' },
];

const ArrowIcon = (): JSX.Element => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-violet-400">
    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
  </svg>
);

export default function RegisterPage(): JSX.Element {
  return (
    <main className="min-h-[calc(100vh-73px)] lg:grid lg:grid-cols-2">
      <Helmet>
        <title>Crear cuenta · Immersphere Pro</title>
        <meta name="description" content="Crea tu cuenta en Immersphere Pro y publica tu primer tour virtual inmersivo en 5 minutos. Sin tarjeta de crédito." />
      </Helmet>

      {/* ── Columna izquierda: formulario ─────────────────────────────── */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <RegisterForm />
        </div>
      </div>

      {/* ── Columna derecha: panel de valor — solo desktop ────────────── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-14 lg:py-16"
        style={{ background: '#0f0a1e' }}
      >
        {/* Panorama de fondo con overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${BG_IMG})` }}
          aria-hidden="true"
        />
        {/* Gradiente sobre la imagen */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, #0f0a1e 0%, rgba(109,40,217,0.25) 60%, #0f0a1e 100%)' }}
          aria-hidden="true"
        />

        {/* Contenido */}
        <div className="relative z-10 w-full max-w-sm">
          {/* Badge */}
          <span className="inline-block rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-violet-400">
            Immersphere Pro
          </span>

          {/* Headline */}
          <h2 className="mt-5 text-4xl font-black leading-tight text-white">
            Tu primer tour<br />en 5 minutos.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-400">
            Sin código. Sin agencias externas.<br />
            Tú controlas la experiencia.
          </p>

          {/* Benefits */}
          <ul className="mt-10 space-y-4">
            {BENEFITS.map((b) => (
              <li key={b.text} className="flex items-center gap-3">
                <ArrowIcon />
                <span className="text-sm font-semibold text-slate-300">{b.text}</span>
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="my-10 h-px w-full bg-white/10" />

          {/* Social proof */}
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Ya confían en Immersphere Pro
          </p>
          <p className="mt-2 text-2xl font-black text-slate-200">
            127 agencias · 2.341 tours
          </p>

          {/* Link a login */}
          <p className="mt-10 text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-black text-violet-400 hover:text-violet-300 transition-colors">
              Entrar →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
