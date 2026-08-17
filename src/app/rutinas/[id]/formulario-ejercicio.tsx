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
      className="h-11 shrink-0 rounded-lg bg-accion px-4 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? "Añadiendo…" : "Añadir"}
    </button>
  );
}

/**
 * Alta de un ejercicio en la rutina (§5.1).
 *
 * Solo pide el ejercicio. Antes pedía además series, repeticiones, rango, peso
 * y descanso: un formulario con una forma distinta de la tabla donde esos
 * mismos valores se editan justo encima, así que la misma pantalla enseñaba dos
 * modelos mentales para la misma cosa. El ejercicio entra con cuatro filas
 * vacías y se rellena en la tabla, que es donde se iba a corregir de todos
 * modos.
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
    <form action={accion} className="mt-4 space-y-2">
      <input type="hidden" name="rutina_id" value={rutinaId} />

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="ejercicio_id" className="sr-only">
          Ejercicio
        </label>
        <select
          id="ejercicio_id"
          name="ejercicio_id"
          required
          className="hundido h-11 min-w-0 flex-1 rounded-lg px-3 text-sm outline-none focus:border-accion"
        >
          {ejercicios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre_canonico}
              {e.grupo_muscular ? ` — ${e.grupo_muscular}` : ""}
            </option>
          ))}
        </select>

        <Boton />
      </div>

      <p className="text-xs text-suave">
        Entra con cuatro series vacías. Peso, repeticiones y descanso se ponen
        arriba, en la tabla del ejercicio.
      </p>

      {estado.error && (
        <p role="alert" className="text-sm text-error">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-sm text-exito">
          {estado.aviso}
        </p>
      )}
    </form>
  );
}
