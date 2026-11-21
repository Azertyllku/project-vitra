import Link from 'next/link';
import { AuthCard } from '@/components/auth-form';
import { SignUpForm } from '@/components/sign-up-form';

export const metadata = { title: 'Inscription — ESPORT HUB' };

export default function InscriptionPage() {
  return (
    <AuthCard title="Créer un compte">
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-zinc-400">
        Déjà inscrit ?{' '}
        <Link href="/connexion" className="text-[var(--accent-blue)] hover:underline">
          Se connecter
        </Link>
      </p>
    </AuthCard>
  );
}
