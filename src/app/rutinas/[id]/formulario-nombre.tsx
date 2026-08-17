"use client";

import { useActionState } from "react";
import { renombrarRutina, type EstadoRutina } from "@/lib/datos/entrenos-acciones";

const INICIAL: EstadoRutina = {};

/**
 * El nombre de la rutina, editable en su sitio (§5.1).
 *
 * Antes había un `h1` con el nombre y, justo debajo, un campo con el mismo
 * nombre y un botón "Renombrar": la misma cadena dos veces en cuatro
 * centímetros. Ahora el título ES el campo.
 *
 * Guarda al salir del campo, como el resto de la pantalla desde el rediseño de
 * la tabla: un botón de guardar aquí y ninguno en las series era otra
 * incoherencia dentro de la misma vista.
 */
export function FormularioNombre({ id, nombre }: { id: string; nombre: string }) {
  const [estado, accion] = useActionState(renombrarRutina, INICIAL);

  return (
    <form action={accion} className="min-w-0 flex-1">
      <input type="hidden" name="id" value={id} />

      <label htmlFor="nombre-rutina" className="sr-only">
        Nombre de la rutina
      </label>
      <input
        id="nombre-rutina"
        name="nombre"
        required
        maxLength={80}
        defaultValue={nombre}
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        className="font-display w-full rounded-md bg-transparent text-2xl font-semibold tracking-tight outline-none focus:bg-hundido focus:px-2"
      />

      {estado.error && (
        <p role="alert" className="mt-1 text-sm text-error">
          {estado.error}
        </p>
      )}
    </form>
  );
}
