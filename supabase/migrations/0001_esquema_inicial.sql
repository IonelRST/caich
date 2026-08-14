-- =============================================================================
-- caich — Esquema inicial (Fase 1)
--
-- Principio rector (ESPECIFICACION.md §7.2 y §14.1):
--   Toda tabla lleva user_id y toda tabla activa Row Level Security EN ESTA
--   MISMA MIGRACIÓN. El aislamiento no es un parche posterior: si naciera en la
--   Fase 3 junto a la capa MCP, todo lo construido antes quedaría permeable.
--
-- Son datos de salud (categoría especial RGPD art. 9). Ver §14.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil de usuario
-- Extiende auth.users de Supabase con las preferencias propias de la app.
-- -----------------------------------------------------------------------------
create table perfil (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  nombre            text,
  unidad_peso       text not null default 'kg' check (unidad_peso in ('kg', 'lbs')),
  unidad_longitud   text not null default 'cm' check (unidad_longitud in ('cm', 'in')),
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Catálogo de ejercicios (§4.1)
--
-- user_id NULL  = ejercicio de la semilla global, visible para todos.
-- user_id != NULL = ejercicio creado por ese usuario (autogenerado por IA y
--                   confirmado por él).
-- Arranca sembrado, nunca vacío: si naciera vacío, el flujo de confirmación se
-- dispararía en cada frase de las primeras sesiones, justo cuando más se nota.
-- -----------------------------------------------------------------------------
create table catalogo_ejercicio (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  nombre_canonico   text not null,
  alias             text[] not null default '{}',
  grupo_muscular    text,
  equipo            text,
  guia_ejecucion    text,
  creado_en         timestamptz not null default now()
);

-- Un usuario no puede duplicar un nombre; la semilla global tampoco.
create unique index catalogo_ejercicio_nombre_unico
  on catalogo_ejercicio (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre_canonico));

-- Búsqueda por alias: resolver "sentadilla" / "squat" / "back squat" al mismo ejercicio.
create index catalogo_ejercicio_alias_idx on catalogo_ejercicio using gin (alias);

-- -----------------------------------------------------------------------------
-- Plantillas: rutina de entreno y plan de dieta (§6.5)
--
-- Ambas comparten forma — "plantilla programada + registro de adherencia" — y
-- por eso comparten tabla. La lógica de planificado / real / desviación es
-- idéntica en los dos casos; duplicarla obligaría a arreglar cada bug dos veces.
-- -----------------------------------------------------------------------------
create table plantilla (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  tipo              text not null check (tipo in ('rutina_entreno', 'plan_dieta')),
  nombre            text not null,
  activa            boolean not null default true,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create index plantilla_user_tipo_idx on plantilla (user_id, tipo) where activa;

-- Ítems de una plantilla.
--   rutina_entreno -> un ejercicio con sus series/reps/peso objetivo
--   plan_dieta     -> una comida con su descripción y macros objetivo
create table plantilla_item (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plantilla_id      uuid not null references plantilla(id) on delete cascade,
  orden             integer not null default 0,

  -- Rutina de entreno
  ejercicio_id      uuid references catalogo_ejercicio(id) on delete restrict,
  series_objetivo   integer check (series_objetivo > 0),
  reps_objetivo     integer check (reps_objetivo > 0),
  peso_objetivo     numeric(6,2) check (peso_objetivo >= 0),

  -- Plan de dieta
  dia_semana        integer check (dia_semana between 1 and 7),
  momento_dia       text,
  descripcion       text,
  cantidad          text,
  calorias          numeric(7,2) check (calorias >= 0),
  proteina_g        numeric(6,2) check (proteina_g >= 0),
  carbohidratos_g   numeric(6,2) check (carbohidratos_g >= 0),
  grasas_g          numeric(6,2) check (grasas_g >= 0),

  creado_en         timestamptz not null default now()
);

create index plantilla_item_plantilla_idx on plantilla_item (plantilla_id, orden);

-- -----------------------------------------------------------------------------
-- Mensaje original (§7.1)
-- El texto crudo se conserva siempre, para poder reprocesar o auditar si el
-- parseo falla o cambia de criterio. Nunca es la fuente de verdad.
-- -----------------------------------------------------------------------------
create table mensaje_original (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  texto             text not null,
  creado_en         timestamptz not null default now()
);

create index mensaje_original_user_idx on mensaje_original (user_id, creado_en desc);

-- -----------------------------------------------------------------------------
-- Registro de entreno (§4.1, §5)
-- -----------------------------------------------------------------------------
create table registro_entreno (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  -- Cuándo ocurrió vs cuándo se guardó. Distintas al registrar algo pasado (§3.2).
  fecha_evento      timestamptz not null,
  fecha_registro    timestamptz not null default now(),

  origen            text not null check (origen in ('chat', 'sesion_en_vivo', 'edicion_manual')),
  plantilla_id      uuid references plantilla(id) on delete set null, -- null = improvisado
  mensaje_id        uuid references mensaje_original(id) on delete set null,
  notas             text,

  -- Sesión en vivo interrumpida (§5.3): se retoma donde se dejó.
  completado        boolean not null default true,

  creado_en         timestamptz not null default now()
);

create index registro_entreno_user_fecha_idx on registro_entreno (user_id, fecha_evento desc);

create table registro_entreno_ejercicio (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  entreno_id        uuid not null references registro_entreno(id) on delete cascade,
  ejercicio_id      uuid not null references catalogo_ejercicio(id) on delete restrict,
  orden             integer not null default 0
);

create index registro_entreno_ejercicio_entreno_idx on registro_entreno_ejercicio (entreno_id, orden);

create table registro_entreno_serie (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  entreno_ejercicio_id uuid not null references registro_entreno_ejercicio(id) on delete cascade,
  numero_serie      integer not null check (numero_serie > 0),
  peso              numeric(6,2) check (peso >= 0),   -- rechaza pesos negativos (§12)
  repeticiones      integer check (repeticiones >= 0)
);

create index registro_entreno_serie_ejercicio_idx on registro_entreno_serie (entreno_ejercicio_id, numero_serie);

-- -----------------------------------------------------------------------------
-- Registro de comida (§4.2, §6)
-- -----------------------------------------------------------------------------
create table registro_comida (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  fecha_evento      timestamptz not null,
  fecha_registro    timestamptz not null default now(),

  origen            text not null check (origen in ('chat', 'plan_dieta', 'edicion_manual')),
  mensaje_id        uuid references mensaje_original(id) on delete set null,

  -- Adherencia contra el plan (§6.2). null = comida sin plan asociado.
  plantilla_item_id uuid references plantilla_item(id) on delete set null,
  adherencia        text check (adherencia in ('igual', 'mas', 'menos', 'otra', 'omitida')),

  momento_dia       text,
  descripcion       text not null,
  cantidad          text,

  calorias          numeric(7,2) check (calorias >= 0),
  proteina_g        numeric(6,2) check (proteina_g >= 0),
  carbohidratos_g   numeric(6,2) check (carbohidratos_g >= 0),
  grasas_g          numeric(6,2) check (grasas_g >= 0),

  -- §4.2: distinguir el origen del dato evita que los insights traten una
  -- estimación con la misma precisión que un dato declarado.
  --   plan      -> procede del plan, cantidades definidas por el usuario
  --   declarado -> el usuario dio cantidades explícitas, la IA calculó macros
  --   estimado  -> la IA estimó también la cantidad
  origen_dato       text not null check (origen_dato in ('plan', 'declarado', 'estimado')),

  creado_en         timestamptz not null default now()
);

create index registro_comida_user_fecha_idx on registro_comida (user_id, fecha_evento desc);

-- -----------------------------------------------------------------------------
-- Registro de medidas corporales (§4.3)
-- Modelo abierto: nombre + valor + unidad, no una lista fija de columnas.
-- -----------------------------------------------------------------------------
create table registro_medida (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  fecha_evento      timestamptz not null,
  fecha_registro    timestamptz not null default now(),

  origen            text not null check (origen in ('chat', 'edicion_manual')),
  mensaje_id        uuid references mensaje_original(id) on delete set null,

  nombre            text not null,          -- 'peso', 'grasa_corporal', 'cintura'...
  valor             numeric(8,3) not null check (valor >= 0),
  unidad            text not null,          -- 'kg', 'lbs', '%', 'cm', 'in'

  creado_en         timestamptz not null default now()
);

create index registro_medida_user_nombre_fecha_idx on registro_medida (user_id, nombre, fecha_evento desc);

-- -----------------------------------------------------------------------------
-- Objetivos (§9)
-- Modelo genérico, no un enum fijo de tipos: cualquier medida o ejercicio puede
-- convertirse en objetivo sin tocar el esquema.
--   measurement:peso | measurement:cintura | exercise_pr:<uuid>
--   nutrition:proteina_diaria | training:sesiones_semanales
-- -----------------------------------------------------------------------------
create table objetivo (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  descripcion       text not null,
  metrica           text not null,
  valor_objetivo    numeric(10,3) not null,
  unidad            text not null,
  direccion         text not null check (direccion in ('subir', 'bajar')),
  fecha_objetivo    date,

  -- Un objetivo cumplido se marca, no se borra: queda en el histórico (§9.2).
  cumplido_en       timestamptz,

  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create index objetivo_user_idx on objetivo (user_id) where cumplido_en is null;

-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Segunda línea de defensa, independiente de la capa MCP de la Fase 3 (§12.1).
-- Si el binding de user_id de esa capa fallara, esto sigue conteniendo la fuga.
-- =============================================================================

alter table perfil                      enable row level security;
alter table catalogo_ejercicio          enable row level security;
alter table plantilla                   enable row level security;
alter table plantilla_item              enable row level security;
alter table mensaje_original            enable row level security;
alter table registro_entreno            enable row level security;
alter table registro_entreno_ejercicio  enable row level security;
alter table registro_entreno_serie      enable row level security;
alter table registro_comida             enable row level security;
alter table registro_medida             enable row level security;
alter table objetivo                    enable row level security;

-- Política estándar: el usuario solo ve y toca sus propias filas.
create policy perfil_propio on perfil
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy plantilla_propia on plantilla
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy plantilla_item_propio on plantilla_item
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy mensaje_original_propio on mensaje_original
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy registro_entreno_propio on registro_entreno
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy registro_entreno_ejercicio_propio on registro_entreno_ejercicio
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy registro_entreno_serie_propia on registro_entreno_serie
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy registro_comida_propia on registro_comida
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy registro_medida_propia on registro_medida
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy objetivo_propio on objetivo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- El catálogo es el único caso especial: la semilla global (user_id null) la
-- lee todo el mundo, pero solo se pueden crear/editar/borrar ejercicios propios.
create policy catalogo_lectura on catalogo_ejercicio
  for select using (user_id is null or auth.uid() = user_id);

create policy catalogo_insercion on catalogo_ejercicio
  for insert with check (auth.uid() = user_id);

create policy catalogo_actualizacion on catalogo_ejercicio
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy catalogo_borrado on catalogo_ejercicio
  for delete using (auth.uid() = user_id);

-- =============================================================================
-- Perfil automático al registrarse
-- =============================================================================

create or replace function crear_perfil_para_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfil (user_id, nombre)
  values (new.id, new.raw_user_meta_data ->> 'nombre');
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function crear_perfil_para_usuario_nuevo();
