"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  crearObjetivo,
  type EstadoObjetivo,
} from "@/lib/datos/objetivos-acciones";

const INICIAL: EstadoObjetivo = {};

export type OpcionMetrica = {
  metrica: string;
  etiqueta: string;
  unidad: string;
};

const claseCampo =
  "hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? "Creando…" : "Crear objetivo"}
    </button>
  );
}

export function FormularioObjetivo({
  opciones,
}: {
  opciones: OpcionMetrica[];
}) {
  const [estado, accion] = useActionState(crearObjetivo, INICIAL);
  const [opcion, setOpcion] = useState<OpcionMetrica>(opciones[0]);

  if (opciones.length === 0) {
    return (
      <p className="mt-4 text-sm text-suave">
        Para fijar un objetivo necesitas al menos una medida registrada o un
        ejercicio en alguna rutina.
      </p>
    );
  }

  return (
    <form action={accion} className="mt-4 space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Objetivo
        </label>
        <input
          id="descripcion"
          name="descripcion"
          required
          maxLength={120}
          placeholder="Bajar a 75 kg"
          className={claseCampo}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="metrica" className="block text-sm font-medium">
          Qué métrica sigue
        </label>
        <select
          id="metrica"
          name="metrica"
          value={opcion.metrica}
          onChange={(e) => {
            const elegida = opciones.find((o) => o.metrica === e.target.value);
            if (elegida) setOpcion(elegida);
          }}
          className={claseCampo}
        >
          {opciones.map((o) => (
            <option key={o.metrica} value={o.metrica}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        <input type="hidden" name="unidad" value={opcion.unidad} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-32 space-y-1.5">
          <label htmlFor="valor_objetivo" className="block text-sm font-medium">
            Valor ({opcion.unidad})
          </label>
          <input
            id="valor_objetivo"
            name="valor_objetivo"
            type="number"
            step="0.1"
            min="0"
            required
            className={claseCampo}
          />
        </div>

        <div className="w-32 space-y-1.5">
          <label htmlFor="direccion" className="block text-sm font-medium">
            Dirección
          </label>
          <select
            id="direccion"
            name="direccion"
            defaultValue="bajar"
            className={claseCampo}
          >
            <option value="bajar">Bajar hasta</option>
            <option value="subir">Subir hasta</option>
          </select>
        </div>

        <div className="w-44 space-y-1.5">
          <label htmlFor="fecha_objetivo" className="block text-sm font-medium">
            Fecha límite
          </label>
          <input
            id="fecha_objetivo"
            name="fecha_objetivo"
            type="date"
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
