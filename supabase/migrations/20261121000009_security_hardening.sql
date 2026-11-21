-- Migration 009 : durcissement sécurité (suite au contrôle des advisors Supabase)

-- Fonction d'aide RLS préinstallée par Supabase : ne doit pas être appelable via l'API REST.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Les partitions de player_match_history ne sont pas accessibles directement par l'API :
-- les requêtes passent par la table parente et ses politiques RLS.
do $$
declare p text;
begin
  for p in
    select c.relname from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class parent on parent.oid = i.inhparent
    where parent.relname = 'player_match_history' and c.relnamespace = 'public'::regnamespace
  loop
    execute format('revoke all on public.%I from anon, authenticated', p);
  end loop;
end $$;
