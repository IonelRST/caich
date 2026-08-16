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
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
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
          className="hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
        />
      </div>
      <Boton />
      {estado.error && (
        <span role="alert" className="text-sm text-error">
          {estado.error}
        </span>
      )}
    </form>
  );
}
