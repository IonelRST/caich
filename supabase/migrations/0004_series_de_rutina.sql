-- =============================================================================
-- caich — Filas de serie explícitas en rutinas y sesiones (§5.1, §5.2)
--
-- La v3.0 modelaba un ejercicio de rutina como tres números sueltos:
-- series_objetivo / reps_objetivo / peso_objetivo. Eso no puede expresar
-- lo que la §5.1 revisada pide — una serie de calentamiento seguida de tres
-- normales y una descendente, con un rango de 6-8 en unas y 12 en otras.
-- Un contador no tiene dónde guardar esa diferencia.
--
-- Así que la serie pasa a ser una fila con identidad propia, en la plantilla
-- y en el registro. Es el cambio estructural de la revisión (§19 punto 6).
--
-- Toda tabla nueva lleva user_id y RLS en esta misma migración (§7.2, §14.1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ejercicio de rutina: lo que es del ejercicio entero, no de cada serie
-- -----------------------------------------------------------------------------

-- Nota del ejercicio (§5.1). Visible durante la sesión en vivo.
alter table plantilla_item add column nota text;

-- Descanso entre series (§5.1). null = temporizador desactivado para este
-- ejercicio; el rango replica el de la referencia: de 5 segundos a 5 minutos.
alter table plantilla_item add column descanso_segundos integer
  check (descanso_segundos between 5 and 300);

-- Superset (§5.1): los ejercicios de una misma plantilla que comparten un
-- valor no nulo forman un grupo. null = ejercicio suelto.
--
-- Es un entero y no una tabla aparte a propósito: un superset no tiene
-- atributos propios: es solo "estos van juntos". Una tabla de grupos añadiría
-- una unión en cada consulta para no guardar nada más que la pertenencia.
alter table plantilla_item add column superset_grupo integer
  check (superset_grupo > 0);

-- -----------------------------------------------------------------------------
-- Series planificadas de una rutina (§5.1)
-- -----------------------------------------------------------------------------
create table plantilla_serie (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  plantilla_item_id uuid not null references plantilla_item(id) on delete cascade,
  numero_serie      integer not null check (numero_serie > 0),

  -- §5.1. 'descendente' además no arranca el temporizador de la serie
  -- siguiente; esa regla vive en la interfaz, aquí solo se guarda el tipo.
  tipo              text not null default 'normal'
                    check (tipo in ('normal', 'calentamiento', 'fallo', 'descendente')),

  peso_objetivo     numeric(6,2) check (peso_objetivo >= 0),

  -- Repeticiones como valor fijo o como rango (§5.1).
  --   reps_max null      -> objetivo fijo, el de reps_min
  --   reps_max no null   -> rango reps_min..reps_max
  reps_min          integer check (reps_min > 0),
  reps_max          integer check (reps_max > 0),

  creado_en         timestamptz not null default now(),

  -- Un rango al revés (8-6) sería un objetivo que nadie sabe leer.
  constraint plantilla_serie_rango_coherente
    check (reps_max is null or reps_min is null or reps_max >= reps_min)
);

create unique index plantilla_serie_orden_unico
  on plantilla_serie (plantilla_item_id, numero_serie);

-- -----------------------------------------------------------------------------
-- Traspaso de los contadores a filas (§5.1)
--
-- Cada ejercicio de rutina existente se convierte en N series normales con el
-- mismo peso y las mismas repeticiones que tenía como objetivo único. Es la
-- lectura fiel de lo que el dato significaba antes.
-- -----------------------------------------------------------------------------
insert into plantilla_serie
  (user_id, plantilla_item_id, numero_serie, tipo, peso_objetivo, reps_min)
select
  pi.user_id,
  pi.id,
  n,
  'normal',
  pi.peso_objetivo,
  pi.reps_objetivo
from plantilla_item pi
cross join lateral generate_series(1, pi.series_objetivo) as n
where pi.ejercicio_id is not null
  and pi.series_objetivo is not null
  and pi.series_objetivo > 0;

-- Ya no hay dos sitios donde vive el objetivo de una serie. Se quitan para que
-- no queden como fuente de verdad alternativa y silenciosamente obsoleta.
alter table plantilla_item drop column series_objetivo;
alter table plantilla_item drop column reps_objetivo;
alter table plantilla_item drop column peso_objetivo;

-- -----------------------------------------------------------------------------
-- Sesión en vivo: lo copiado del ejercicio de rutina (§5.2)
--
-- Se copia en lugar de referenciarse porque la sesión es independiente de la
-- rutina desde que arranca: editar la rutina mañana no puede reescribir lo que
-- pasó hoy. Es la misma razón por la que ya se copiaban los ejercicios.
-- -----------------------------------------------------------------------------
alter table registro_entreno_ejercicio add column nota text;

alter table registro_entreno_ejercicio add column descanso_segundos integer
  check (descanso_segundos between 5 and 300);

alter table registro_entreno_ejercicio add column superset_grupo integer
  check (superset_grupo > 0);

-- -----------------------------------------------------------------------------
-- Series registradas: tipo y estado de completado (§5.2)
--
-- Cambia el momento en que nace la fila. Antes se insertaba al confirmar una
-- serie, así que existir equivalía a estar hecha. Ahora las filas se crean al
-- empezar la sesión, copiadas del plan, y el usuario las va marcando: es lo
-- que permite ver la tabla entera del ejercicio antes de tocarla.
-- -----------------------------------------------------------------------------
alter table registro_entreno_serie add column tipo text not null default 'normal'
  check (tipo in ('normal', 'calentamiento', 'fallo', 'descendente'));

-- Se añade con default true para que las series ya guardadas —que solo existían
-- si estaban hechas— queden marcadas como completadas. El default pasa a false
-- justo después, que es lo que corresponde a partir de ahora.
alter table registro_entreno_serie add column completada boolean not null default true;
alter table registro_entreno_serie alter column completada set default false;

-- Objetivo de la serie, copiado del plan al arrancar la sesión (§5.2). Sirve
-- para precargar la fila y para saber si la sesión se desvió de la rutina, que
-- es lo que dispara la pregunta de actualizar la plantilla (§5.3).
alter table registro_entreno_serie add column peso_objetivo numeric(6,2)
  check (peso_objetivo >= 0);
alter table registro_entreno_serie add column reps_min integer check (reps_min > 0);
alter table registro_entreno_serie add column reps_max integer check (reps_max > 0);

alter table registro_entreno_serie add constraint registro_entreno_serie_rango_coherente
  check (reps_max is null or reps_min is null or reps_max >= reps_min);

-- -----------------------------------------------------------------------------
-- RLS (§7.2, §14.1) — misma migración que la tabla, sin excepción
-- -----------------------------------------------------------------------------
alter table plantilla_serie enable row level security;

create policy plantilla_serie_propia on plantilla_serie
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
