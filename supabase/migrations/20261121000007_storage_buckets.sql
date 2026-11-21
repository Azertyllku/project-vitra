-- Migration 007 : Supabase Storage (avatars, bannières, logos) + politiques
-- avatars/{user_id}/..  banners/{user_id}/..  logos/{...} (staff uniquement). SVG exclu (XSS).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('banners', 'banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('logos',   'logos',   true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
declare b text;
begin
  foreach b in array array['avatars', 'banners'] loop
    execute format($f$create policy "%1$s_select_own" on storage.objects for select to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b);
    execute format($f$create policy "%1$s_insert_own" on storage.objects for insert to authenticated
      with check (bucket_id = %1$L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b);
    execute format($f$create policy "%1$s_update_own" on storage.objects for update to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = %1$L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b);
    execute format($f$create policy "%1$s_delete_own" on storage.objects for delete to authenticated
      using (bucket_id = %1$L and (storage.foldername(name))[1] = (select auth.uid())::text)$f$, b);
  end loop;
end $$;

create policy "logos_staff_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (select private.is_staff()));
create policy "logos_staff_update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (select private.is_staff()))
  with check (bucket_id = 'logos' and (select private.is_staff()));
create policy "logos_staff_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (select private.is_staff()));
