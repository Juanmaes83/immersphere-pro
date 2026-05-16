import { Helmet } from 'react-helmet-async';
import RegisterForm from '@/components/auth/RegisterForm';

export default function RegisterPage(): JSX.Element {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
      <Helmet>
        <title>Crear cuenta · Immersphere Pro</title>
        <meta name="description" content="Crea tu tenant en Immersphere Pro y empieza a publicar tours virtuales inmersivos para tus propiedades." />
      </Helmet>
      <RegisterForm />
    </main>
  );
}
