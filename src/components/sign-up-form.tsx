'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Field } from '@/components/auth-form';

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Inscription côté navigateur (client Supabase) : pas de Server Action. */
export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get('username') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!USERNAME_RE.test(username)) {
      setError('Pseudo : 3 à 24 caractères (lettres, chiffres, underscore).');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Adresse email invalide.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setPending(true);
    setError(null);

    const { data: result, error: authError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(`Inscription impossible : ${authError.message}`);
      setPending(false);
      return;
    }

    // Session immédiate si la confirmation email est désactivée, sinon email de confirmation.
    if (result.session) {
      router.push('/profil');
      router.refresh();
      return;
    }
    router.push('/connexion?message=' + encodeURIComponent('Compte créé. Confirmez votre email puis connectez-vous.'));
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <Field label="Pseudo" name="username" autoComplete="username" minLength={3} />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Mot de passe (8 caractères minimum)" name="password" type="password" autoComplete="new-password" minLength={8} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-medium transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? 'Création…' : 'Créer mon compte'}
      </button>
    </form>
  );
}
