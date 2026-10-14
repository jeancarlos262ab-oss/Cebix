-- Parcela satelital: guarda junto a la parcela TODO lo calculado (contorno GeoJSON, las 10 variables,
-- intervalo al 90 %, ciclo y advertencias). Ejecutar una sola vez en Supabase → SQL Editor.
-- Es seguro repetirlo: no hace nada si la columna ya existe. Las políticas RLS actuales de la tabla
-- siguen aplicando (la columna nueva queda cubierta por ellas).

alter table public.parcels_custom
  add column if not exists satelite jsonb;

comment on column public.parcels_custom.satelite is
  'Detalle del cálculo satelital: { version, geometry, anio, estado, features, ic90_inferior, ic90_superior, advertencias, proveedor, calculado_en }';

-- Pide a PostgREST que recargue el esquema para que la columna se vea de inmediato.
notify pgrst, 'reload schema';
