"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { renombrarRutina, type EstadoRutina } from "@/lib/datos/entrenos-acciones";

const INICIAL: EstadoRutina = {};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="control h-11 shrink-0 rounded-lg px-4 text-sm font-medium disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Renombrar"}
    </button>
  );
}

export function FormularioNombre({ id, nombre }: { id: string; nombre: string }) {
  const [estado, accion] = useActionState(renombrarRutina, INICIAL);

  return (
    <form action={accion} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={id} />

      <div className="min-w-48 flex-1 space-y-1.5">
        <label htmlFor="nombre-rutina" className="block text-xs font-medium text-suave">
          Nombre de la rutina
        </label>
        <input
          id="nombre-rutina"
          name="nombre"
          required
          maxLength={80}
          defaultValue={nombre}
          className="hundido h-11 w-full rounded-lg px-3 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
        />
      </div>

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
    </form>
  );
}
