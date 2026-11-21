import Link from 'next/link';
import { AuthCard } from '@/components/auth-form';
import { SignInForm } from '@/components/sign-in-form';

export const metadata = { title: 'Connexion — ESPORT HUB' };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  return (
    <AuthCard title="Connexion" error={error} message={message}>
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm text-zinc-400">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="text-[var(--accent-blue)] hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthCard>
  );
}
