-- =============================================================================
-- 0006 — Ascenso a la biblioteca desde el chat (§6.6)
--
-- Cuando una comida registrada por chat se repite, la app OFRECE guardarla en
-- la biblioteca. Ofrece, no guarda: una biblioteca que se llena sola de
-- entradas que el usuario no ha decidido crear deja de ser suya y pasa a ser
-- una lista que hay que limpiar.
--
-- Esta tabla guarda lo contrario de una comida: las veces que el usuario dijo
-- que no. Sin ella, "descartar" duraría hasta la siguiente recarga y la oferta
-- volvería a salir con cada repetición, que es justo lo que convierte una
-- sugerencia en una molestia.
-- =============================================================================

create table comida_sugerencia_descartada (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  -- Descripción normalizada (minúsculas, sin acentos, espacios colapsados).
  -- Se compara por esta clave y no por el texto literal, para que "Pollo con
  -- arroz" y "pollo con  arroz" cuenten como la misma comida.
  clave       text not null,

  creado_en   timestamptz not null default now(),

  unique (user_id, clave)
);

create index comida_sugerencia_descartada_user_idx
  on comida_sugerencia_descartada (user_id, clave);

alter table comida_sugerencia_descartada enable row level security;

create policy comida_sugerencia_descartada_propia on comida_sugerencia_descartada
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
