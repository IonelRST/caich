"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { guardarCierre, type EstadoRutina } from "@/lib/datos/entrenos-acciones";

const INICIAL: EstadoRutina = {};

const claseCampo =
  "hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 w-full rounded-xl bg-accion text-base font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Guardar entreno"}
    </button>
  );
}

/** Valor para <input type="datetime-local">, que espera hora local sin zona. */
function paraCampoLocal(iso: string) {
  const d = new Date(iso);
  const desfase = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - desfase).toISOString().slice(0, 16);
}

export function FormularioCierre({
  id,
  fechaEvento,
  notas,
  desviada,
}: {
  id: string;
  fechaEvento: string;
  notas: string | null;
  desviada: boolean;
}) {
  const [estado, accion] = useActionState(guardarCierre, INICIAL);

  return (
    <form action={accion} className="mt-8 space-y-5">
      <input type="hidden" name="id" value={id} />

      <div className="space-y-1.5">
        <label htmlFor="fecha_evento" className="block text-sm font-medium">
          Fecha y hora
        </label>
        <input
          id="fecha_evento"
          name="fecha_evento"
          type="datetime-local"
          defaultValue={paraCampoLocal(fechaEvento)}
          className={claseCampo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notas" className="block text-sm font-medium">
          Notas
        </label>
        <textarea
          id="notas"
          name="notas"
          rows={3}
          defaultValue={notas ?? ""}
          placeholder="Opcional"
          className={claseCampo}
        />
      </div>

      {/* §5.3: la plantilla solo se toca con confirmación explícita, y solo se
          pregunta si de verdad cambió la forma del plan. */}
      {desviada && (
        <fieldset className="alzado rounded-lg p-3">
          <legend className="px-1 text-sm font-medium">
            La sesión no siguió la rutina
          </legend>
          <p className="text-xs text-suave">
            Cambiaron los ejercicios o el número de series respecto a la rutina
            guardada.
          </p>

          <div className="mt-3 space-y-2 text-sm">
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="actualizar_plantilla"
                value="no"
                defaultChecked
                className="h-4 w-4"
              />
              Dejar la rutina como estaba
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="actualizar_plantilla"
                value="si"
                className="h-4 w-4"
              />
              Actualizar la rutina con lo de hoy
            </label>
          </div>
        </fieldset>
      )}

      <Boton />

      {estado.error && (
        <p role="alert" className="text-sm text-error">
          {estado.error}
        </p>
      )}

      <Link
        href={`/entreno/${id}`}
        className="block text-center text-sm text-suave underline underline-offset-4"
      >
        Volver al entreno
      </Link>
    </form>
  );
}
