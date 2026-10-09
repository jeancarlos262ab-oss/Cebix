-- Ejecutar UNA sola vez en Supabase: Dashboard -> SQL Editor -> New query -> Run.
--
-- Fotos de perfil: bucket público "avatars" donde cada persona solo puede escribir,
-- reemplazar y borrar dentro de su propia carpeta (<user_id>/...). Cualquiera puede VER
-- las fotos (la URL pública se guarda en profiles.avatar_url y se muestra a todo el equipo).
-- Límite 2 MB y solo imágenes: el frontend ya las reduce a 256x256 antes de subirlas,
-- pero esto lo hace cumplir el servidor aunque alguien salte la interfaz.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];

drop policy if exists "avatars: ver" on storage.objects;
drop policy if exists "avatars: subir propia" on storage.objects;
drop policy if exists "avatars: reemplazar propia" on storage.objects;
drop policy if exists "avatars: borrar propia" on storage.objects;

create policy "avatars: ver"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: subir propia"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: reemplazar propia"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: borrar propia"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
