import type { Metadata } from 'next';
import Link from 'next/link';
import { one } from '@/lib/params';

export const metadata: Metadata = {
  title: 'Confidentialité et cookies',
  description: 'Données personnelles collectées par ESPORT HUB, finalités, durées, droits et cookies.',
  alternates: { canonical: '/confidentialite' },
};

const h2 = 'mt-10 text-xl font-semibold';
const p = 'mt-3 text-zinc-300 leading-relaxed';
const ul = 'mt-3 list-disc space-y-1 pl-5 text-zinc-300';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ConfidentialitePage({ searchParams }: Props) {
  const sp = await searchParams;
  const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      {one(sp.compte) === 'supprime' && (
        <p role="status" className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Votre compte et ses données ont été supprimés.
        </p>
      )}
      <h1 className="text-3xl font-bold">Confidentialité et cookies</h1>
      <p className={p}>Cette page explique quelles données ESPORT HUB traite, pourquoi, combien de temps, et comment exercer vos droits.</p>

      <h2 className={h2}>Données que nous traitons</h2>
      <ul className={ul}>
        <li><strong>Compte</strong> : adresse e-mail, mot de passe (stocké chiffré par le service d’authentification, jamais lisible), pseudo, ESPORT ID, nom affiché, pays, avatar et biographie si vous les renseignez.</li>
        <li><strong>Comptes de jeu</strong> : identifiant public de votre compte chez le fournisseur (Steam, Riot Games, Battle.net, Epic Games) lorsque vous le connectez. Nous ne recevons jamais vos mots de passe.</li>
        <li><strong>Performances</strong> : parties saisies par vous ou importées depuis un fournisseur, statistiques et rangs associés à vos comptes de jeu. Un compte n’est visible publiquement que si vous le décidez.</li>
        <li><strong>Communauté</strong> : publications, commentaires, réactions, abonnements, messages privés, blocages, messages du chat des diffusions.</li>
        <li><strong>Usage du service</strong> : favoris, playlists, historique de visionnage, notifications et leurs préférences, mise en page de votre tableau de bord, rapports d’analyse générés à votre demande.</li>
        <li><strong>Modération et sécurité</strong> : signalements, sanctions, journal des actions d’administration.</li>
      </ul>

      <h2 className={h2}>Pourquoi et sur quelle base</h2>
      <ul className={ul}>
        <li>Fournir le service que vous avez demandé (compte, suivi des performances, communauté) : exécution du contrat.</li>
        <li>Assurer la sécurité, lutter contre les abus et modérer : intérêt légitime.</li>
        <li>Les rapports d’analyse sont produits par des règles automatiques ; si un modèle déûment configuré est utilisé, seules des données agrégées de vos parties lui sont transmises, et chaque rapport indique son mode de génération.</li>
      </ul>
      <p className={p}>Nous ne vendons pas vos données et n’utilisons ni publicité ciblée ni outil de mesure d’audience.</p>

      <h2 className={h2}>Qui y a accès</h2>
      <ul className={ul}>
        <li>Les prestataires techniques qui font fonctionner le site : base de données, authentification et fonctions serveur (Supabase) et l’hébergeur du site.</li>
        <li>Les fournisseurs de connexion que vous choisissez d’utiliser (Steam, Riot Games, Battle.net, Epic Games), uniquement au moment de la connexion d’un compte.</li>
        <li>Les lecteurs vidéo intégrés (Twitch, YouTube) lorsque vous lancez une vidéo.</li>
        <li>L’équipe d’administration, dans la limite de ses rôles (modération, gestion du contenu).</li>
      </ul>

      <h2 className={h2}>Durée de conservation</h2>
      <p className={p}>Vos données sont conservées tant que votre compte existe. Lorsque vous supprimez votre compte, vos données personnelles sont supprimées ; dans le journal d’administration, votre nom est détaché des actions éventuellement effectuées.</p>

      <h2 className={h2}>Vos droits</h2>
      <ul className={ul}>
        <li><strong>Accès et portabilité</strong> : téléchargez vos données au format JSON depuis <Link href="/profil/donnees" className="text-[var(--accent-blue)] underline">Mes données</Link>.</li>
        <li><strong>Rectification</strong> : modifiez vos informations depuis votre profil.</li>
        <li><strong>Effacement</strong> : supprimez votre compte depuis la même page.</li>
        <li><strong>Opposition, limitation</strong> : {contact ? <>écrivez-nous à <a href={`mailto:${contact}`} className="text-[var(--accent-blue)] underline">{contact}</a>.</> : 'contactez l’éditeur du site.'}</li>
        <li>Vous pouvez aussi introduire une réclamation auprès de la CNIL (cnil.fr).</li>
      </ul>

      <h2 className={h2}>Cookies</h2>
      <p className={p}>ESPORT HUB n’utilise que des cookies strictement nécessaires, qui ne demandent pas de consentement : la session de connexion et un jeton de sécurité temporaire lors de la connexion d’un compte de jeu. Votre choix « J’ai compris » est mémorisé dans le stockage local de votre navigateur, pas dans un cookie.</p>
      <p className={p}>Les lecteurs Twitch et YouTube sont opérés par ces sociétés, qui peuvent déposer leurs propres cookies lorsque vous lancez une vidéo : consultez leurs politiques pour les maîtriser.</p>
    </main>
  );
}
