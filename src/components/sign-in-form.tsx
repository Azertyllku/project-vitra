'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeNext } from '@/lib/safe-redirect';
import { Field } from '@/components/auth-form';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Connexion côté navigateur (client Supabase) : pas de Server Action. */
export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!EMAIL_RE.test(email) || !password) {
      setError('Email ou mot de passe invalide.');
      return;
    }
    setPending(true);
    setError(null);

    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) {
      setError(
        authError.message === 'Email not confirmed'
          ? 'Email non confirmé. Vérifiez votre boîte mail.'
          : 'Identifiants incorrects.',
      );
      setPending(false);
      return;
    }
    router.push(safeNext(next));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Mot de passe" name="password" type="password" autoComplete="current-password" />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-medium transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}
