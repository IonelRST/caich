-- =============================================================================
-- 0005 — Biblioteca de comidas (§6.1)
--
-- La §6 pasaba por exigir un plan semanal antes de que la vía de comida sirviera
-- de nada. La unidad deja de ser la casilla "martes, comida" y pasa a ser la
-- comida guardada: nombre, cantidad y macros calculados una vez.
--
-- El plan semanal sobrevive como capa opcional encima (§6.4): sus items pasan a
-- poder apuntar a una comida de la biblioteca en vez de repetir la descripción.
-- =============================================================================

create table comida_guardada (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  nombre            text not null,
  -- Los alimentos y sus cantidades, en texto. §6.1 exige cantidad siempre: se
  -- piensa una vez, con calma, y de ahí salen los macros.
  cantidad          text not null,

  calorias          numeric(7,2) check (calorias >= 0),
  proteina_g        numeric(6,2) check (proteina_g >= 0),
  carbohidratos_g   numeric(6,2) check (carbohidratos_g >= 0),
  grasas_g          numeric(6,2) check (grasas_g >= 0),

  -- §6.1: la lista se ordena por uso, para que lo de siempre quede arriba sin
  -- buscarlo. Se guardan aquí en vez de contarse sobre registro_comida porque
  -- la lista se pinta en cada carga de /dieta y un COUNT por fila no escala.
  veces_registrada  integer not null default 0 check (veces_registrada >= 0),
  ultima_vez        timestamptz,

  creado_en         timestamptz not null default now()
);

create index comida_guardada_uso_idx
  on comida_guardada (user_id, ultima_vez desc nulls last, veces_registrada desc);

alter table comida_guardada enable row level security;

create policy comida_guardada_propia on comida_guardada
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Enlaces desde lo que ya existía
-- -----------------------------------------------------------------------------

-- De qué comida de la biblioteca salió el registro. Opcional: el chat sigue
-- registrando texto libre sin pasar por la biblioteca (§6.2).
alter table registro_comida
  add column comida_guardada_id uuid references comida_guardada(id) on delete set null;

-- Un item del plan pasa a poder apuntar a una comida guardada (§6.4). Sigue
-- siendo opcional para no romper los items que ya tuvieran descripción propia.
alter table plantilla_item
  add column comida_guardada_id uuid references comida_guardada(id) on delete cascade;

-- Registrar desde la biblioteca es un origen nuevo: no viene del chat, no viene
-- del plan, y no es una edición a mano.
alter table registro_comida drop constraint registro_comida_origen_check;
alter table registro_comida add constraint registro_comida_origen_check
  check (origen in ('chat', 'plan_dieta', 'biblioteca', 'edicion_manual'));
