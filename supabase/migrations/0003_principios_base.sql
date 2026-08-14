-- =============================================================================
-- caich — Base curada de principios (ESPECIFICACION.md §11.4 y §16)
--
-- Es la única ancla que autoriza a la IA a afirmar una relación causal o a
-- recomendar un cambio (§11.2). Sin un principio aprobado detrás, un insight
-- solo puede quedarse en observación sin conclusión (§11.3).
--
-- Por eso `aprobado` importa tanto: un principio redactado por la IA pero no
-- revisado todavía NO sirve como ancla. Si valiera, la base curada no curaría
-- nada — sería la IA autorizándose a sí misma.
-- =============================================================================

create table principio_base (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  enunciado         text not null,

  -- Ámbito al que aplica, para no traer principios de nutrición a un insight de
  -- volumen de entreno.
  ambito            text not null check (ambito in ('entrenamiento', 'nutricion', 'recuperacion')),

  -- §11.4: la IA redacta el borrador, el usuario lo aprueba una vez.
  aprobado          boolean not null default false,

  orden             integer not null default 0,

  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create index principio_base_user_idx on principio_base (user_id, orden);

-- Consulta caliente: los insights de nivel 2 solo cargan los aprobados.
create index principio_base_aprobados_idx on principio_base (user_id) where aprobado;

alter table principio_base enable row level security;

create policy principio_base_propio on principio_base
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
