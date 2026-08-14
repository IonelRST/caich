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
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion disabled:opacity-50"
    >
      {pending ? "Añadiendo…" : "Añadir"}
    </button>
  );
}

const claseCampo =
  "w-full rounded-lg border border-borde bg-transparent px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

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
        <select
          id="ejercicio_id"
          name="ejercicio_id"
          required
          className={claseCampo}
        >
          {ejercicios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_canonico}
              {e.grupo_muscular ? ` — ${e.grupo_muscular}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-24 space-y-1.5">
          <label htmlFor="series_objetivo" className="block text-sm font-medium">
            Series
          </label>
          <input
            id="series_objetivo"
            name="series_objetivo"
            type="number"
            min={1}
            max={20}
            defaultValue={4}
            required
            className={claseCampo}
          />
        </div>

        <div className="w-24 space-y-1.5">
          <label htmlFor="reps_objetivo" className="block text-sm font-medium">
            Reps
          </label>
          <input
            id="reps_objetivo"
            name="reps_objetivo"
            type="number"
            min={1}
            max={100}
            defaultValue={8}
            required
            className={claseCampo}
          />
        </div>

        <div className="w-28 space-y-1.5">
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
      </div>

      <div className="flex items-center gap-3">
        <Boton />
        {estado.error && (
          <span role="alert" className="text-sm text-error">
            {estado.error}
          </span>
        )}
        {estado.aviso && (
          <span
            role="status"
            className="text-sm text-exito"
          >
            {estado.aviso}
          </span>
        )}
      </div>
    </form>
  );
}
