-- Ejecutar UNA sola vez en Supabase: Dashboard -> SQL Editor -> New query -> Run.
--
-- Antes: parcels_custom era una tabla compartida por todo el equipo (cualquier cuenta
-- veía las parcelas de todas). Ahora cada parcela pertenece a quien la capturó y cada
-- cuenta solo ve, edita y borra las suyas. El frontend no necesita cambios: al insertar,
-- user_id se llena solo con el usuario autenticado (default auth.uid()).

alter table public.parcels_custom
  add column if not exists user_id uuid
    references auth.users (id) on delete cascade
    default auth.uid();

create index if not exists parcels_custom_user_idx on public.parcels_custom (user_id);

drop policy if exists "parcels_custom: todo autenticado" on public.parcels_custom;
drop policy if exists "parcels_custom: ver propias" on public.parcels_custom;
drop policy if exists "parcels_custom: insertar propias" on public.parcels_custom;
drop policy if exists "parcels_custom: editar propias" on public.parcels_custom;
drop policy if exists "parcels_custom: borrar propias" on public.parcels_custom;

create policy "parcels_custom: ver propias"
  on public.parcels_custom for select to authenticated
  using (auth.uid() = user_id);

create policy "parcels_custom: insertar propias"
  on public.parcels_custom for insert to authenticated
  with check (auth.uid() = user_id);

create policy "parcels_custom: editar propias"
  on public.parcels_custom for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "parcels_custom: borrar propias"
  on public.parcels_custom for delete to authenticated
  using (auth.uid() = user_id);

-- Las parcelas que ya existían NO tienen dueño (user_id = null), así que ninguna cuenta las
-- verá. Elige UNA de estas dos opciones (descomenta la que quieras):
--
--   a) Borrar los datos de prueba anteriores:
--      delete from public.parcels_custom where user_id is null;
--
--   b) Asignarlas a una cuenta concreta (reemplaza el correo):
--      update public.parcels_custom
--         set user_id = (select id from auth.users where email = 'tu-correo@ejemplo.com')
--       where user_id is null;
