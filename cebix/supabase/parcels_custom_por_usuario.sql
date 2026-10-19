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