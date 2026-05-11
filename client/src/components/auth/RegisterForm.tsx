import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function RegisterForm(): JSX.Element {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [tenantName, setTenantName] = useState('Demo Real Estate Studio');
  const [name, setName] = useState('Admin Demo');
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('Immersphere123!');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    clearError();

    try {
      await register({ tenantName, name, email, password });
      navigate('/dashboard');
    } catch {
      // El store ya expone el error para la UI.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-violet-700">Nuevo tenant</p>
      <h1 className="mt-4 text-4xl font-black text-slate-950">Crear cuenta</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">Crea una empresa demo con plan Starter para empezar a publicar experiencias.</p>

      <label className="mt-8 block">
        <span className="mb-2 block text-sm font-black text-slate-700">Empresa / Tenant</span>
        <input
          required
          value={tenantName}
          onChange={(event) => setTenantName(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-500"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-black text-slate-700">Nombre completo</span>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-500"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-2 block text-sm font-black text-slate-700">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-500"
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
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none focus:border-violet-500"
        />
      </label>

      {error ? (
        <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? 'Creando...' : 'Crear tenant'}
      </button>
    </form>
  );
}
