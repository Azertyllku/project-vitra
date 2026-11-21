import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-zinc-500">Erreur 404</p>
      <h1 className="mt-2 text-3xl font-bold">Page introuvable</h1>
      <p className="mt-3 text-zinc-400">Cette page n’existe pas ou n’est plus disponible.</p>
      <Link href="/" className="mt-6 rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium hover:brightness-110">
        Retour à l’accueil
      </Link>
    </main>
  );
}
