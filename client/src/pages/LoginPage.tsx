import { Helmet } from 'react-helmet-async';
import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage(): JSX.Element {
  return (
    <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
      <Helmet>
        <title>Entrar · Immersphere Pro</title>
        <meta name="description" content="Accede a tu cuenta de Immersphere Pro para gestionar tus propiedades y tours virtuales." />
      </Helmet>
      <LoginForm />
    </main>
  );
}
