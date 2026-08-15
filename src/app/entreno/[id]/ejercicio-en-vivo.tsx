"use client";

import { useActionState, useRef } from "react";
import {
  anadirSerieSesion,
  borrarSerie,
  completarSerie,
  type EstadoRutina,
} from "@/lib/datos/entrenos-acciones";
import {
  TIPOS_SERIE,
  colorSuperset,
  etiquetasDeSerie,
  etiquetaSuperset,
  textoObjetivoReps,
  type SerieAnterior,
  type SerieRegistrada,
} from "@/lib/datos/entrenos";

const INICIAL: EstadoRutina = {};

/**
 * Un ejercicio dentro de la sesión en vivo (§5.2).
 *
 * La unidad es la fila de serie, no el ejercicio: número · anterior · peso ·
 * reps · completado. Es la densidad de la referencia, y la §21.7 la admite
 * como única excepción al mínimo táctil global — con un suelo de 40px de alto
 * de fila y 40×32px en el control de marcar.
 */
export function EjercicioEnVivo({
  entrenoId,
  entrenoEjercicioId,
  nombre,
  nota,
  descansoSegundos,
  supersetGrupo,
  series,
  anteriores,
  alCompletar,
}: {
  entrenoId: string;
  entrenoEjercicioId: string;
  nombre: string;
  nota: string | null;
  descansoSegundos: number | null;
  supersetGrupo: number | null;
  series: SerieRegistrada[];
  anteriores: Map<number, SerieAnterior>;
  alCompletar: (descanso: number | null) => void;
}) {
  const hechas = series.filter((s) => s.completada).length;
  const etiquetas = etiquetasDeSerie(series.map((s) => s.tipo));

  return (
    <section
      className="rounded-xl border border-borde p-3"
      style={
        supersetGrupo != null
          ? {
              borderLeftWidth: "4px",
              borderLeftColor: colorSuperset(supersetGrupo),
            }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium">{nombre}</h2>
        <span className="shrink-0 text-xs text-suave">
          {hechas}/{series.length} series
        </span>
      </div>

      {/* §21.9: el color del superset nunca es el único canal — va con borde
          lateral y con esta etiqueta, legible en escala de grises. */}
      {supersetGrupo != null && (
        <p className="mt-1 text-xs font-medium text-suave">
          Superserie {etiquetaSuperset(supersetGrupo)}
        </p>
      )}

      {nota && <p className="mt-1 text-xs text-suave">{nota}</p>}

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-suave">
            <th scope="col" className="w-9 pb-1 font-medium">
              Serie
            </th>
            <th scope="col" className="pb-1 font-medium">
              Anterior
            </th>
            <th scope="col" className="w-20 pb-1 font-medium">
              Kg
            </th>
            <th scope="col" className="w-20 pb-1 font-medium">
              Reps
            </th>
            <th scope="col" className="w-11 pb-1">
              <span className="sr-only">Completada</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {series.map((s, i) => (
            <FilaSerie
              key={s.id}
              entrenoId={entrenoId}
              entrenoEjercicioId={entrenoEjercicioId}
              serie={s}
              etiqueta={etiquetas[i]}
              anterior={anteriores.get(s.numero_serie) ?? null}
              // §5.1: una serie descendente se encadena a la anterior, así que
              // completar la de antes no debe abrir un descanso en medio.
              descanso={
                series[i + 1]?.tipo === "descendente" ? null : descansoSegundos
              }
              alCompletar={alCompletar}
            />
          ))}
        </tbody>
      </table>

      <form action={anadirSerieSesion} className="mt-2">
        <input
          type="hidden"
          name="entreno_ejercicio_id"
          value={entrenoEjercicioId}
        />
        <input type="hidden" name="entreno_id" value={entrenoId} />
        <button
          type="submit"
          className="h-11 w-full rounded-lg border border-borde text-sm font-medium text-suave"
        >
          + Añadir serie
        </button>
      </form>
    </section>
  );
}

function FilaSerie({
  entrenoId,
  entrenoEjercicioId,
  serie,
  etiqueta,
  anterior,
  descanso,
  alCompletar,
}: {
  entrenoId: string;
  entrenoEjercicioId: string;
  serie: SerieRegistrada;
  etiqueta: { numero: string; sigla: string };
  anterior: SerieAnterior | null;
  descanso: number | null;
  alCompletar: (descanso: number | null) => void;
}) {
  const pesoRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const [estado, accion] = useActionState(completarSerie, INICIAL);

  const objetivo = textoObjetivoReps(serie.reps_min, serie.reps_max);

  // Precarga en cascada: lo ya tecleado, si no lo de la última vez, si no el
  // objetivo del plan. Lo normal es marcar la serie sin tocar nada (§5.2).
  const pesoInicial = serie.peso ?? anterior?.peso ?? serie.peso_objetivo ?? "";
  const repsInicial = serie.repeticiones ?? anterior?.repeticiones ?? serie.reps_min ?? "";

  const copiarAnterior = () => {
    if (!anterior) return;
    if (pesoRef.current && anterior.peso != null) {
      pesoRef.current.value = String(anterior.peso);
    }
    if (repsRef.current && anterior.repeticiones != null) {
      repsRef.current.value = String(anterior.repeticiones);
    }
  };

  const textoAnterior = anterior
    ? `${anterior.peso ?? "–"} kg × ${anterior.repeticiones ?? "–"}`
    : "—";

  return (
    <tr className={serie.completada ? "bg-exito/10" : undefined}>
      <td className="py-0.5">
        <span
          className="inline-flex h-10 w-9 items-center justify-center gap-px text-xs text-suave"
          title={TIPOS_SERIE.find((t) => t.valor === serie.tipo)?.etiqueta}
        >
          <span className="tabular-nums">{etiqueta.numero}</span>
          {etiqueta.sigla && (
            <span className="text-[10px] font-semibold text-aviso">
              {etiqueta.sigla}
            </span>
          )}
        </span>
      </td>

      <td className="py-0.5">
        {/* Tocar el valor anterior lo copia a la fila (§5.2). */}
        <button
          type="button"
          onClick={copiarAnterior}
          disabled={!anterior}
          className="h-10 w-full truncate text-left text-xs text-suave disabled:opacity-60"
          aria-label={
            anterior
              ? `Usar lo de la última vez: ${textoAnterior}`
              : "Sin referencia anterior"
          }
        >
          {textoAnterior}
        </button>
      </td>

      <td className="py-0.5">
        <input
          ref={pesoRef}
          form={`serie-${serie.id}`}
          name="peso"
          type="number"
          inputMode="decimal"
          step="0.5"
          min={0}
          defaultValue={pesoInicial}
          placeholder={serie.peso_objetivo != null ? String(serie.peso_objetivo) : "–"}
          aria-label={`Peso de la serie ${serie.numero_serie}`}
          className="h-10 w-full rounded-md border border-borde bg-transparent px-1.5 text-center text-base tabular-nums outline-none focus:border-accion"
        />
      </td>

      <td className="py-0.5">
        <input
          ref={repsRef}
          form={`serie-${serie.id}`}
          name="repeticiones"
          type="number"
          inputMode="numeric"
          step="1"
          min={0}
          defaultValue={repsInicial}
          placeholder={objetivo || "–"}
          aria-label={`Repeticiones de la serie ${serie.numero_serie}${objetivo ? `, objetivo ${objetivo}` : ""}`}
          className="h-10 w-full rounded-md border border-borde bg-transparent px-1.5 text-center text-base tabular-nums outline-none focus:border-accion"
        />
      </td>

      <td className="py-0.5">
        <form id={`serie-${serie.id}`} action={accion}>
          <input type="hidden" name="id" value={serie.id} />
          <input type="hidden" name="entreno_id" value={entrenoId} />
          <input
            type="hidden"
            name="completada"
            value={serie.completada ? "false" : "true"}
          />
          <button
            type="submit"
            // El descanso arranca en el cliente al pulsar y no al volver del
            // servidor: entre una cosa y otra hay una ida y vuelta de red, y
            // el descanso ya está corriendo en la vida real.
            onClick={() => {
              if (!serie.completada) alCompletar(descanso);
            }}
            aria-pressed={serie.completada}
            aria-label={`${serie.completada ? "Desmarcar" : "Marcar"} la serie ${serie.numero_serie}`}
            className={`h-10 w-10 rounded-md border text-base leading-none ${
              serie.completada
                ? "border-exito bg-exito text-fondo"
                : "border-borde text-suave"
            }`}
          >
            ✓
          </button>
        </form>
        {estado.error && (
          <p role="alert" className="mt-1 text-[11px] text-error">
            {estado.error}
          </p>
        )}
      </td>

      <td className="w-7 py-0.5">
        <form action={borrarSerie}>
          <input type="hidden" name="id" value={serie.id} />
          <input type="hidden" name="entreno_id" value={entrenoId} />
          <input
            type="hidden"
            name="entreno_ejercicio_id"
            value={entrenoEjercicioId}
          />
          <button
            type="submit"
            aria-label={`Borrar la serie ${serie.numero_serie}`}
            className="h-10 w-7 text-xs text-suave hover:text-error"
          >
            ✕
          </button>
        </form>
      </td>
    </tr>
  );
}
