import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalButton, SubscribeButton } from '@/components/premium-actions';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { getEntitlements } from '@/lib/data/entitlements';
import { formatDate, formatMoney } from '@/lib/format';
import { one } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Premium' };

interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_interval: 'month' | 'year';
  price_cents: number | null;
  currency: string;
  stripe_price_id: string | null;
  features: string[];
}

const COMPARISON: [string, boolean, boolean][] = [
  ['Matchs, résultats, tournois, équipes et profils publics', true, true],
  ['Rediffusions, communauté, messagerie et notifications', true, true],
  ['Statistiques essentielles (7, 30 et 90 jours), observations, historique des parties', true, true],
  ['Statistiques avancées : moyennes, résultats par carte, personnage et rôle', false, true],
  ['Analyses historiques approfondies (6 mois, 1 an, carrière)', false, true],
  ['Comparaisons avancées (statistiques détaillées)', false, true],
  ['Tableau de bord personnalisable et graphiques supplémentaires', false, true],
  ['Alertes avancées (séries de victoires et de défaites)', false, true],
  ['Rapports et résumés IA', false, true],
];

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  trialing: 'Période d’essai',
  past_due: 'Paiement en retard',
  canceled: 'Résilié',
  unpaid: 'Impayé',
  incomplete: 'Incomplet',
  incomplete_expired: 'Expiré',
  paused: 'En pause',
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PremiumPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ent = await getEntitlements();
  const supabase = await createClient();

  const [plansRes, settingRes, subRes, paymentsRes] = await Promise.all([
    supabase.from('subscription_plans').select('id, code, name, description, billing_interval, price_cents, currency, stripe_price_id, features').eq('is_active', true).order('sort_order').returns<Plan[]>(),
    supabase.from('platform_settings').select('value').eq('key', 'billing_enabled').maybeSingle<{ value: unknown }>(),
    ent.userId
      ? supabase.from('subscriptions').select('status, current_period_end, cancel_at_period_end, plan:subscription_plans(name)').eq('user_id', ent.userId).order('created_at', { ascending: false }).limit(1).returns<{ status: string; current_period_end: string | null; cancel_at_period_end: boolean; plan: { name: string } | null }[]>()
      : Promise.resolve({ data: [] as never[] }),
    ent.userId
      ? supabase.from('payments').select('id, amount_cents, currency, status, paid_at, created_at, hosted_invoice_url').eq('user_id', ent.userId).order('created_at', { ascending: false }).limit(10).returns<{ id: string; amount_cents: number; currency: string; status: string; paid_at: string | null; created_at: string; hosted_invoice_url: string | null }[]>()
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const plans = plansRes.data ?? [];
  const billingEnabled = settingRes.data?.value === true;
  const subscription = subRes.data?.[0];
  const payments = paymentsRes.data ?? [];
  const status = one(sp.statut);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Premium" subtitle="Allez plus loin dans l’analyse de vos performances." />

      {status === 'succes' && <p role="status" className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200">Merci ! Votre abonnement sera activé dès la confirmation du paiement (quelques secondes). Rechargez la page si besoin.</p>}
      {status === 'annule' && <p role="status" className="mb-6 rounded-xl border border-[var(--border)] px-4 py-3 text-zinc-300">Paiement annulé. Aucun montant n’a été débité.</p>}

      {ent.isPremium && (
        <Card className="mb-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">Vous avez accès à Premium <Badge tone="violet">Actif</Badge></p>
              {subscription ? (
                <p className="mt-1 text-sm text-zinc-400">
                  {subscription.plan?.name ?? 'Abonnement'} · {STATUS_LABEL[subscription.status] ?? subscription.status}
                  {subscription.current_period_end ? ` · ${subscription.cancel_at_period_end ? 'prend fin le' : 'renouvellement le'} ${formatDate(subscription.current_period_end)}` : ''}
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-400">Accès accordé par votre rôle sur la plateforme.</p>
              )}
            </div>
            {subscription && <PortalButton />}
          </div>
        </Card>
      )}

      <SectionTitle>Gratuit et Premium</SectionTitle>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-zinc-400"><th className="px-4 py-3">Fonctionnalité</th><th className="px-4 py-3 text-center">Gratuit</th><th className="px-4 py-3 text-center">Premium</th></tr></thead>
          <tbody>
            {COMPARISON.map(([label, free, premium]) => (
              <tr key={label} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">{label}</td>
                <td className="px-4 py-3 text-center" aria-label={free ? 'Inclus' : 'Non inclus'}>{free ? '✓' : '—'}</td>
                <td className="px-4 py-3 text-center text-[var(--accent-blue)]" aria-label={premium ? 'Inclus' : 'Non inclus'}>{premium ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-xs text-zinc-500">Le paiement est facultatif : tout le reste de ESPORT HUB reste gratuit. ESPORT HUB n’affiche actuellement aucune publicité.</p>

      {!ent.isPremium && (
        <>
          <SectionTitle>Choisir une offre</SectionTitle>
          {!billingEnabled || plans.length === 0 ? (
            <EmptyState>Les abonnements Premium ne sont pas encore ouverts. Les fonctionnalités gratuites restent disponibles.</EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {plans.map((plan) => (
                <li key={plan.id}>
                  <Card className="flex h-full flex-col p-6">
                    <p className="text-lg font-semibold">{plan.name}</p>
                    {plan.description && <p className="mt-1 text-sm text-zinc-400">{plan.description}</p>}
                    <p className="mt-4 text-3xl font-bold">
                      {formatMoney(plan.price_cents != null ? plan.price_cents / 100 : null, plan.currency) ?? 'Tarif à définir'}
                      {plan.price_cents != null && <span className="text-base font-normal text-zinc-400"> / {plan.billing_interval === 'month' ? 'mois' : 'an'}</span>}
                    </p>
                    <div className="mt-6">
                      {plan.stripe_price_id ? <SubscribeButton planCode={plan.code} loggedIn={Boolean(ent.userId)}>S’abonner</SubscribeButton> : <p className="text-sm text-zinc-500">Bientôt disponible.</p>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {payments.length > 0 && (
        <>
          <SectionTitle>Mes paiements</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3">{formatDate(p.paid_at ?? p.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(p.amount_cents / 100, p.currency)}</td>
                    <td className="px-4 py-3">{p.status === 'paid' ? 'Payé' : p.status === 'failed' ? 'Échoué' : p.status}</td>
                    <td className="px-4 py-3 text-right">{p.hosted_invoice_url && /^https:\/\//.test(p.hosted_invoice_url) && <a href={p.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-blue)] hover:underline">Facture</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {ent.isStaff && (
        <>
          <SectionTitle>Mise en service du paiement (administrateurs)</SectionTitle>
          <Card className="p-5 text-sm text-zinc-300">
            <p>Statut : paiement <strong>{billingEnabled ? 'activé' : 'désactivé'}</strong> · {plans.length} offre{plans.length > 1 ? 's' : ''} active{plans.length > 1 ? 's' : ''}.</p>
            <p className="mt-2 text-zinc-400">Pour ouvrir les abonnements : créer les prix dans Stripe, définir les secrets des Edge Functions, renseigner les offres puis activer le réglage. La procédure complète est dans <code>docs/BILLING_AND_AI.md</code>.</p>
            <p className="mt-2"><Link href="/moderation" className="text-[var(--accent-blue)] hover:underline">Modération</Link></p>
          </Card>
        </>
      )}
    </main>
  );
}
