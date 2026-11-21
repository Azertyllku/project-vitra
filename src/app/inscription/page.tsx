import Link from 'next/link';
import { signUp } from '@/app/auth/actions';
import { AuthCard, Field, SubmitButton } from '@/components/auth-form';

export const metadata = { title: 'Inscription — ESPORT HUB' };

export default async function InscriptionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthCard title="Créer un compte" error={error}>
      <form action={signUp}>
        <Field label="Pseudo" name="username" autoComplete="username" minLength={3} />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Mot de passe (8 caractères minimum)" name="password" type="password" autoComplete="new-password" minLength={8} />
        <SubmitButton>Créer mon compte</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-400">
        Déjà inscrit ?{' '}
        <Link href="/connexion" className="text-[var(--accent-blue)] hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthCard>
  );
}
