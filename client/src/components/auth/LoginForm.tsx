import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useBrand } from '@/hooks/useBrand';

export default function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { bgStyle, colorStyle } = useBrand();
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Immersphere123!');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearError();

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch {
      // El store ya expone el error para la UI.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.22em]" style={colorStyle}>Immersphere Pro</p>
      <h1 className="mt-4 text-4xl font-black text-slate-950">Entrar</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Accede con tu usuario para gestionar propiedades, planes y experiencias inmersivas.</p>

      <label className="mt-8 block">
        <span className="mb-2 block text-sm font-black text-slate-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="brand-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-black text-slate-700">Contraseña</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="brand-focus w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none"
        />
      </label>

      {error ? (
        <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-6 w-full rounded-2xl px-5 py-4 text-sm font-black text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={bgStyle}
      >
        {isLoading ? 'Entrando...' : 'Entrar al dashboard'}
      </button>
    </form>
  );
}
