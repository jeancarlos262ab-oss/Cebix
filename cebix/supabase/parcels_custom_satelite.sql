alter table public.parcels_custom
  add column if not exists satelite jsonb;

comment on column public.parcels_custom.satelite is
  'Detalle del cálculo satelital: { version, geometry, anio, estado, features, ic90_inferior, ic90_superior, advertencias, proveedor, calculado_en }';

notify pgrst, 'reload schema';