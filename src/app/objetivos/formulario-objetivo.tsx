"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  actualizarObjetivo,
  crearObjetivo,
  type EstadoObjetivo,
} from "@/lib/datos/objetivos-acciones";

const INICIAL: EstadoObjetivo = {};

export type OpcionMetrica = {
  metrica: string;
  etiqueta: string;
  unidad: string;
};

/** Un objetivo tal y como lo necesita el formulario para precargarse. */
export type ObjetivoEditable = {
  id: string;
  descripcion: string;
  metrica: string;
  valor_objetivo: number;
  unidad: string;
  direccion: string;
  fecha_objetivo: string | null;
};

const claseCampo =
  "hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

function Boton({ editando }: { editando: boolean }) {
  const { pending } = useFormStatus();
  const texto = editando ? "Guardar cambios" : "Crear objetivo";
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? "Guardando…" : texto}
    </button>
  );
}

/**
 * Editar un objetivo ya creado (punto 22 de la §19).
 *
 * Reutiliza el formulario de alta en vez de duplicarlo: los campos y sus
 * validaciones son los mismos, y mantener dos copias garantizaba que una de las
 * dos se quedara atrás.
 */
export function EditorObjetivo({
  objetivo,
  opciones,
}: {
  objetivo: ObjetivoEditable;
  opciones: OpcionMetrica[];
}) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-xs text-suave underline underline-offset-4 hover:text-texto"
      >
        Editar
      </button>
    );
  }

  return (
    <div className="w-full">
      <FormularioObjetivo
        opciones={opciones}
        objetivo={objetivo}
        alTerminar={() => setAbierto(false)}
      />
    </div>
  );
}

export function FormularioObjetivo({
  opciones,
  objetivo,
  alTerminar,
}: {
  opciones: OpcionMetrica[];
  objetivo?: ObjetivoEditable;
  alTerminar?: () => void;
}) {
  const [estado, accion] = useActionState(
    objetivo ? actualizarObjetivo : crearObjetivo,
    INICIAL,
  );

  // Si la métrica del objetivo ya no está entre las opciones —porque se borró
  // la medida o el ejercicio de origen— se añade para no perderla al guardar.
  const disponibles =
    objetivo && !opciones.some((o) => o.metrica === objetivo.metrica)
      ? [
          ...opciones,
          {
            metrica: objetivo.metrica,
            etiqueta: objetivo.metrica,
            unidad: objetivo.unidad,
          },
        ]
      : opciones;

  const [opcion, setOpcion] = useState<OpcionMetrica>(
    disponibles.find((o) => o.metrica === objetivo?.metrica) ?? disponibles[0],
  );

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
      {objetivo && <input type="hidden" name="id" value={objetivo.id} />}

      <div className="space-y-1.5">
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Objetivo
        </label>
        <input
          id="descripcion"
          name="descripcion"
          required
          maxLength={120}
          defaultValue={objetivo?.descripcion}
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
          {disponibles.map((o) => (
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
            defaultValue={objetivo?.valor_objetivo}
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
            defaultValue={objetivo?.direccion ?? "bajar"}
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
            defaultValue={objetivo?.fecha_objetivo?.slice(0, 10) ?? ""}
            className={claseCampo}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Boton editando={Boolean(objetivo)} />
        {alTerminar && (
          <button
            type="button"
            onClick={alTerminar}
            className="text-sm text-suave underline underline-offset-4"
          >
            Cancelar
          </button>
        )}
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
