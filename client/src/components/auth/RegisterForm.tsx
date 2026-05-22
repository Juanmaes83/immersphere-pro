import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useBrand } from '@/hooks/useBrand';

// ── sessionStorage key ────────────────────────────────────────────────────────
const DRAFT_KEY = 'imm_register_draft';

// ── Iconos inline ─────────────────────────────────────────────────────────────
const IcoCheck = (): JSX.Element => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
  </svg>
);

const IcoEye = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const IcoEyeOff = (): JSX.Element => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const IcoWarn = (): JSX.Element => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-red-500">
    <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
  </svg>
);

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FieldErrors {
  email?: string;
  password?: string;
  name?: string;
  tenantName?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterForm(): JSX.Element {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { bgStyle, colorStyle } = useBrand();

  // ── Estado del formulario ─────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Immersphere123!');
  const [name, setName] = useState('Admin Demo');
  const [tenantName, setTenantName] = useState('Demo Real Estate Studio');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // ── sessionStorage: rehidratar al montar ──────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved) as Partial<{ email: string; name: string; tenantName: string }>;
        if (d.email) setEmail(d.email);
        if (d.name) setName(d.name);
        if (d.tenantName) setTenantName(d.tenantName);
      }
    } catch { /* ignore */ }
  }, []);

  // ── sessionStorage: persistir al cambiar (sin password por seguridad) ─────
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ email, name, tenantName }));
    } catch { /* ignore */ }
  }, [email, name, tenantName]);

  function clearDraft(): void {
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  }

  // ── Validaciones ──────────────────────────────────────────────────────────
  function validateStep1(): boolean {
    const errs: FieldErrors = {};
    if (!email || !EMAIL_RE.test(email)) errs.email = 'Introduce un email válido';
    if (!password || password.length < 8) errs.password = 'Mínimo 8 caracteres';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: FieldErrors = {};
    if (!name || name.trim().length < 2) errs.name = 'Mínimo 2 caracteres';
    if (!tenantName || tenantName.trim().length < 2) errs.tenantName = 'Mínimo 2 caracteres';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function clearFieldError(field: keyof FieldErrors): void {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleStep1Submit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    clearError();
    if (validateStep1()) setStep(2);
  }

  async function handleStep2Submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    clearError();
    if (!validateStep2()) return;
    try {
      await register({ tenantName, name, email, password });
      clearDraft();
      navigate('/dashboard');
    } catch { /* error lo expone el store */ }
  }

  function handleBack(): void {
    setFieldErrors({});
    clearError();
    setStep(1);
  }

  // ── ¿El error es "email ya existe"? ──────────────────────────────────────
  const isEmailTaken = Boolean(
    error && (error.toLowerCase().includes('email') || error.toLowerCase().includes('existe'))
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Header */}
      <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>
        Immersphere Pro
      </p>
      <h1 className="mt-3 text-3xl font-black text-slate-950">
        {step === 1 ? 'Crea tu cuenta' : 'Cuéntanos sobre tu negocio'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {step === 1
          ? 'Tu primer tour inmersivo en 5 minutos. Sin tarjeta.'
          : 'Casi listo — solo un par de datos más.'}
      </p>

      {/* Barra de progreso */}
      <div className="mt-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            Paso {step} de 2
          </span>
          <span className="text-xs font-black text-slate-400">{step === 1 ? '50%' : '100%'}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: step === 1 ? '50%' : '100%',
              background: 'var(--brand, #7C3AED)',
            }}
          />
        </div>
      </div>

      {/* ── PASO 1 ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <form
          key="step1"
          onSubmit={handleStep1Submit}
          noValidate
          className="mt-8 animate-in fade-in slide-in-from-right-2 duration-200"
        >
          {/* Email */}
          <div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-slate-700">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                onBlur={() => {
                  if (email && !EMAIL_RE.test(email)) {
                    setFieldErrors((p) => ({ ...p, email: 'Introduce un email válido' }));
                  }
                }}
                className={`brand-focus w-full rounded-2xl border bg-white px-4 py-3 font-semibold outline-none transition ${
                  fieldErrors.email ? 'border-red-400 bg-red-50' : 'border-slate-200'
                }`}
              />
            </label>
            {fieldErrors.email && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600">
                <IcoWarn /> {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Contraseña */}
          <div className="mt-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-slate-700">Contraseña</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                  onBlur={() => {
                    if (password && password.length < 8) {
                      setFieldErrors((p) => ({ ...p, password: 'Mínimo 8 caracteres' }));
                    }
                  }}
                  className={`brand-focus w-full rounded-2xl border bg-white px-4 py-3 pr-12 font-semibold outline-none transition ${
                    fieldErrors.password ? 'border-red-400 bg-red-50' : 'border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                >
                  {showPassword ? <IcoEyeOff /> : <IcoEye />}
                </button>
              </div>
            </label>
            {fieldErrors.password && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600">
                <IcoWarn /> {fieldErrors.password}
              </p>
            )}
          </div>

          {/* CTA paso 1 */}
          <button
            type="submit"
            className="mt-7 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98]"
            style={bgStyle}
          >
            Continuar →
          </button>

          {/* Trust signals */}
          <TrustStrip />

          {/* Link login */}
          <p className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="font-black text-slate-700 hover:underline">
              Entrar →
            </Link>
          </p>
        </form>
      )}

      {/* ── PASO 2 ─────────────────────────────────────────────────────── */}
      {step === 2 && (
        <form
          key="step2"
          onSubmit={handleStep2Submit}
          noValidate
          className="mt-8 animate-in fade-in slide-in-from-right-2 duration-200"
        >
          {/* Nombre completo */}
          <div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-slate-700">Nombre completo</span>
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
                onBlur={() => {
                  if (name && name.trim().length < 2) {
                    setFieldErrors((p) => ({ ...p, name: 'Mínimo 2 caracteres' }));
                  }
                }}
                className={`brand-focus w-full rounded-2xl border bg-white px-4 py-3 font-semibold outline-none transition ${
                  fieldErrors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'
                }`}
              />
            </label>
            {fieldErrors.name && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600">
                <IcoWarn /> {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Nombre agencia */}
          <div className="mt-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-black text-slate-700">Nombre de tu agencia</span>
              <input
                type="text"
                autoComplete="organization"
                required
                value={tenantName}
                onChange={(e) => { setTenantName(e.target.value); clearFieldError('tenantName'); }}
                onBlur={() => {
                  if (tenantName && tenantName.trim().length < 2) {
                    setFieldErrors((p) => ({ ...p, tenantName: 'Mínimo 2 caracteres' }));
                  }
                }}
                className={`brand-focus w-full rounded-2xl border bg-white px-4 py-3 font-semibold outline-none transition ${
                  fieldErrors.tenantName ? 'border-red-400 bg-red-50' : 'border-slate-200'
                }`}
              />
            </label>
            {fieldErrors.tenantName && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600">
                <IcoWarn /> {fieldErrors.tenantName}
              </p>
            )}
          </div>

          {/* Error de servidor */}
          {error && (
            <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {isEmailTaken ? (
                <span>
                  Este email ya está registrado.{' '}
                  <Link to="/login" className="underline">
                    Inicia sesión →
                  </Link>
                </span>
              ) : (
                error
              )}
            </div>
          )}

          {/* CTA paso 2 */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-7 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={bgStyle}
          >
            {isLoading ? 'Creando tu cuenta...' : 'Empezar ahora →'}
          </button>

          {/* Trust signals */}
          <TrustStrip />

          {/* Volver */}
          <button
            type="button"
            onClick={handleBack}
            className="mt-4 w-full text-center text-sm font-bold text-slate-400 hover:text-slate-600 transition"
          >
            ← Volver
          </button>
        </form>
      )}
    </div>
  );
}

// ── Trust strip reutilizable ──────────────────────────────────────────────────
function TrustStrip(): JSX.Element {
  const IcoCheck = (): JSX.Element => (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-emerald-500">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );

  return (
    <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-slate-400">
      <span className="flex items-center gap-1.5"><IcoCheck /> Sin tarjeta</span>
      <span className="flex items-center gap-1.5"><IcoCheck /> 3 tours gratis</span>
      <span className="flex items-center gap-1.5"><IcoCheck /> Sin permanencia</span>
    </div>
  );
}
