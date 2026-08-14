"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { crearRutina, type EstadoRutina } from "@/lib/datos/entrenos-acciones";

const INICIAL: EstadoRutina = {};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
    >
      {pending ? "Creando…" : "Crear"}
    </button>
  );
}

export function FormularioRutina() {
  const [estado, accion] = useActionState(crearRutina, INICIAL);

  return (
    <form action={accion} className="mt-4 flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1 space-y-1.5">
        <label htmlFor="nombre" className="block text-sm font-medium">
          Nombre de la rutina
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={80}
          placeholder="Pierna A"
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300"
        />
      </div>
      <Boton />
      {estado.error && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </span>
      )}
    </form>
  );
}
