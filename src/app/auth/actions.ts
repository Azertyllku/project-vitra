'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';

const USERNAME_RE = /^[A-Za-z0-9_]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(path: string, message: string, next?: string): never {
  const params = new URLSearchParams({ error: message });
  if (next) params.set('next', next);
  redirect(`${path}?${params.toString()}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = safeNext(formData.get('next'));

  if (!EMAIL_RE.test(email) || !password) fail('/connexion', 'Email ou mot de passe invalide.', next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail('/connexion', 'Identifiants incorrects ou email non confirmé.', next);

  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const username = String(formData.get('username') ?? '').trim();

  if (!EMAIL_RE.test(email)) fail('/inscription', 'Adresse email invalide.');
  if (password.length < 8) fail('/inscription', 'Le mot de passe doit contenir au moins 8 caractères.');
  if (!USERNAME_RE.test(username))
    fail('/inscription', 'Pseudo : 3 à 24 caractères (lettres, chiffres, underscore).');

  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: username },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) fail('/inscription', 'Inscription impossible. Vérifiez vos informations.');

  // Session immédiate si la confirmation email est désactivée, sinon email de confirmation.
  if (data.session) redirect('/profil');
  redirect('/connexion?message=' + encodeURIComponent('Compte créé. Confirmez votre email puis connectez-vous.'));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
