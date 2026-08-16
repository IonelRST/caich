"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  MEDIDAS_HABITUALES,
  type MedidaHabitual,
} from "@/lib/datos/medidas";
import { registrarMedida, type EstadoMedida } from "@/lib/datos/medidas-acciones";

const ESTADO_INICIAL: EstadoMedida = {};

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

function hoyISO(): string {
  // Fecha local, no UTC: toISOString() daría el día anterior por la tarde en
  // husos al oeste de Greenwich.
  const ahora = new Date();
  const desfase = ahora.getTimezoneOffset() * 60_000;
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 10);
}

export function FormularioMedida() {
  const [estado, accion] = useActionState(registrarMedida, ESTADO_INICIAL);
  const [medida, setMedida] = useState<MedidaHabitual>(MEDIDAS_HABITUALES[0]);
  const refValor = useRef<HTMLInputElement>(null);

  return (
    <form
      action={async (formData) => {
        await accion(formData);
        // Vaciar solo el valor: al registrar varias medidas seguidas, la fecha
        // y el tipo casi siempre se repiten.
        if (refValor.current) {
          refValor.current.value = "";
          refValor.current.focus();
        }
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-3">
        <div className="min-w-40 flex-1 space-y-1.5">
          <label htmlFor="nombre" className="block text-sm font-medium">
            Qué mides
          </label>
          <select
            id="nombre"
            name="nombre"
            value={medida.nombre}
            onChange={(e) => {
              const elegida = MEDIDAS_HABITUALES.find(
                (m) => m.nombre === e.target.value,
              );
              if (elegida) setMedida(elegida);
            }}
            className="hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
          >
            {MEDIDAS_HABITUALES.map((m) => (
              <option key={m.nombre} value={m.nombre}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="w-28 space-y-1.5">
          <label htmlFor="valor" className="block text-sm font-medium">
            Valor
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={refValor}
              id="valor"
              name="valor"
              type="number"
              step="0.1"
              min="0"
              inputMode="decimal"
              required
              className="hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
            />
            <span className="text-sm text-suave">
              {medida.unidad}
            </span>
          </div>
          <input type="hidden" name="unidad" value={medida.unidad} />
        </div>

        <div className="w-40 space-y-1.5">
          <label htmlFor="fecha" className="block text-sm font-medium">
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={hoyISO()}
            max={hoyISO()}
            required
            className="hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BotonGuardar />
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
