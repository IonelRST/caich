"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  anadirEjercicio,
  type EstadoRutina,
} from "@/lib/datos/entrenos-acciones";
import type { Ejercicio } from "@/lib/datos/entrenos";

const INICIAL: EstadoRutina = {};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 rounded-lg bg-accion px-4 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? "Añadiendo…" : "Añadir"}
    </button>
  );
}

const claseCampo =
  "hundido h-11 w-full rounded-lg px-3 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

/**
 * Alta de un ejercicio en la rutina (§5.1).
 *
 * Pide "cuántas series" por comodidad, pero lo que se crea son N filas
 * independientes. A partir de ahí cada una se edita por separado arriba: es
 * ahí donde se marca el calentamiento o la serie descendente.
 */
export function FormularioEjercicio({
  rutinaId,
  ejercicios,
}: {
  rutinaId: string;
  ejercicios: Ejercicio[];
}) {
  const [estado, accion] = useActionState(anadirEjercicio, INICIAL);

  return (
    <form action={accion} className="mt-4 space-y-3">
      <input type="hidden" name="rutina_id" value={rutinaId} />

      <div className="space-y-1.5">
        <label htmlFor="ejercicio_id" className="block text-sm font-medium">
          Ejercicio
        </label>
        <select id="ejercicio_id" name="ejercicio_id" required className={claseCampo}>
          {ejercicios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_canonico}
              {e.grupo_muscular ? ` — ${e.grupo_muscular}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-20 space-y-1.5">
          <label htmlFor="series" className="block text-sm font-medium">
            Series
          </label>
          <input
            id="series"
            name="series"
            type="number"
            min={1}
            max={20}
            defaultValue={4}
            required
            className={claseCampo}
          />
        </div>

        <div className="w-20 space-y-1.5">
          <label htmlFor="reps_min" className="block text-sm font-medium">
            Reps
          </label>
          <input
            id="reps_min"
            name="reps_min"
            type="number"
            min={1}
            max={100}
            defaultValue={8}
            required
            className={claseCampo}
          />
        </div>

        <div className="w-20 space-y-1.5">
          <label htmlFor="reps_max" className="block text-sm font-medium">
            a
          </label>
          <input
            id="reps_max"
            name="reps_max"
            type="number"
            min={1}
            max={100}
            placeholder="rango"
            className={claseCampo}
          />
        </div>

        <div className="w-24 space-y-1.5">
          <label htmlFor="peso_objetivo" className="block text-sm font-medium">
            Peso (kg)
          </label>
          <input
            id="peso_objetivo"
            name="peso_objetivo"
            type="number"
            step="0.5"
            min={0}
            placeholder="opcional"
            className={claseCampo}
          />
        </div>

        <div className="w-32 space-y-1.5">
          <label htmlFor="descanso_segundos" className="block text-sm font-medium">
            Descanso
          </label>
          <select
            id="descanso_segundos"
            name="descanso_segundos"
            defaultValue="90"
            className={claseCampo}
          >
            <option value="">Sin temporizador</option>
            {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => (
              <option key={s} value={s}>
                {s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Boton />
        {estado.error && (
          <span role="alert" className="text-sm text-error">
            {estado.error}
          </span>
        )}
        {estado.aviso && (
          <span role="status" className="text-sm text-exito">
            {estado.aviso}
          </span>
        )}
      </div>
    </form>
  );
}
