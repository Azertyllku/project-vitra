import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SignOutButton } from '@/components/sign-out-button';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Mon profil — ESPORT HUB' };

const link = 'rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5';

export default async function ProfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/connexion?next=/profil');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('esport_id, username, display_name, country_code, created_at')
    .eq('id', user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold">Mon profil</h1>
      {error || !profile ? (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300">
          Impossible de charger votre profil pour le moment.
        </p>
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-zinc-400">ESPORT ID</p>
          <p className="mb-4 font-mono text-2xl tracking-wider text-[var(--accent-blue)]">{profile.esport_id}</p>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-zinc-400">Pseudo</dt>
            <dd><Link href={`/membres/${profile.username}`} className="hover:text-[var(--accent-blue)]">{profile.username}</Link></dd>
            <dt className="text-zinc-400">Nom affiché</dt>
            <dd>{profile.display_name ?? '—'}</dd>
            <dt className="text-zinc-400">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-zinc-400">Membre depuis</dt>
            <dd>{new Date(profile.created_at).toLocaleDateString('fr-FR')}</dd>
          </dl>
        </section>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/profil/performances" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium hover:brightness-110">Mes performances</Link>
        <Link href="/profil/comptes" className={link}>Comptes de jeu</Link>
        <Link href="/profil/comparateur" className={link}>Comparateur</Link>
        <Link href="/profil/videos" className={link}>Mes vidéos</Link>
        <Link href="/messages" className={link}>Messages</Link>
        <Link href="/profil/notifications" className={link}>Notifications</Link>
        <Link href="/profil/donnees" className={link}>Mes données</Link>
        <SignOutButton />
      </div>
    </main>
  );
}
