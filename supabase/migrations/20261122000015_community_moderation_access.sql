-- Migration 015 : le staff ne peut lire un message privé que s'il fait l'objet d'un signalement ouvert
-- (confidentialité par défaut).
create policy messages_staff_reported on public.messages for select to authenticated
  using (
    (select private.is_staff())
    and exists (select 1 from public.reports r where r.target_type = 'message' and r.target_id = messages.id and r.status = 'open')
  );
