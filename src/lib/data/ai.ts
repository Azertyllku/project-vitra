import { createClient } from '@/lib/supabase/server';

export interface AiReport {
  id: string;
  content: string;
  provider: 'rules' | 'anthropic';
  model: string | null;
  created_at: string;
}

/** Derniers rapports IA du membre connecté pour une cible (la RLS ne renvoie que les siens). */
export async function fetchReports(column: 'account_id' | 'match_id' | 'tournament_id', id: string, kind: 'performance' | 'match' | 'tournament', limit = 3): Promise<AiReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('ai_reports')
    .select('id, content, provider, model, created_at')
    .eq('kind', kind)
    .eq(column, id)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<AiReport[]>();
  return data ?? [];
}
