-- Masar — Storage buckets for avatars and event photos.
-- Files are stored under "<user id>/<file>" so ownership is checkable from the path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-photos', 'event-photos', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public read masar images" on storage.objects for select
  using (bucket_id in ('avatars', 'event-photos'));

create policy "users upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'event-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users update own files" on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars', 'event-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own files" on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars', 'event-photos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
