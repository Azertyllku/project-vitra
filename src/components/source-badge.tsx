import { Badge } from '@/components/ui';

const SOURCE: Record<string, { label: string; tone: 'neutral' | 'violet' | 'amber' }> = {
  official: { label: 'Officiel', tone: 'violet' },
  imported: { label: 'Importé', tone: 'neutral' },
  manual: { label: 'Saisie manuelle', tone: 'neutral' },
  demo: { label: 'Démo', tone: 'amber' },
};

/** Provenance d'une donnée : officielle, importée ou déclarée manuellement. */
export function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE[source] ?? { label: source, tone: 'neutral' as const };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function VerificationBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { unverified: 'Non vérifié', pending: 'Vérification en cours', verified: 'Vérifié', rejected: 'Refusé' };
  return <Badge tone={status === 'verified' ? 'violet' : 'neutral'}>{labels[status] ?? status}</Badge>;
}
