-- Migration 008 : Supabase Realtime (tables publiques de matchs ; la RLS s'applique aux abonnés)

do $$
declare t text;
begin
  foreach t in array array['matches', 'match_teams', 'match_events', 'match_results'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
