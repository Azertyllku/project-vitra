import Link from 'next/link';
import { signIn } from '@/app/auth/actions';
import { AuthCard, Field, SubmitButton } from '@/components/auth-form';

export const metadata = { title: 'Connexion — ESPORT HUB' };

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const { error, message, next } = await searchParams;
  return (
    <AuthCard title="Connexion" error={error} message={message}>
      <form action={signIn}>
        <input type="hidden" name="next" value={next ?? ''} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" />
        <SubmitButton>Se connecter</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="text-[var(--accent-blue)] hover:underline">
          Créer un compte
        </Link>
      </p>
    </AuthCard>
  );
}
