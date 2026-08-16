"use client";

import { useActionState } from "react";
import {
  actualizarEjercicio,
  actualizarSerieRutina,
  alternarSuperset,
  anadirSerieRutina,
  moverEjercicio,
  quitarEjercicio,
  quitarSerieRutina,
  type EstadoRutina,
} from "@/lib/datos/entrenos-acciones";
import {
  TIPOS_SERIE,
  colorSuperset,
  etiquetaSuperset,
  type ItemRutina,
} from "@/lib/datos/entrenos";

const INICIAL: EstadoRutina = {};

/**
 * Un ejercicio del constructor de rutinas (§5.1).
 *
 * Esta pantalla no es la sesión en vivo: se usa sentado y con calma, así que
 * sigue el tema general de la app y los objetivos táctiles normales de la
 * §21.7. La excepción de densidad es solo para la tabla del entreno.
 */
export function EditorEjercicio({
  item,
  rutinaId,
  puedeSubir,
  puedeAgrupar,
}: {
  item: ItemRutina;
  rutinaId: string;
  puedeSubir: boolean;
  puedeAgrupar: boolean;
}) {
  const [estadoItem, accionItem] = useActionState(actualizarEjercicio, INICIAL);

  return (
    <section
      className="alzado rounded-xl p-4"
      style={
        item.superset_grupo != null
          ? {
              borderLeftWidth: "4px",
              borderLeftColor: colorSuperset(item.superset_grupo),
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{item.ejercicio.nombre_canonico}</h3>
          {item.superset_grupo != null && (
            <p className="text-xs font-medium text-suave">
              Superserie {etiquetaSuperset(item.superset_grupo)}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <BotonIcono
            accion={moverEjercicio}
            campos={{ id: item.id, rutina_id: rutinaId, direccion: "arriba" }}
            etiqueta="Subir"
            desactivado={!puedeSubir}
          >
            ↑
          </BotonIcono>
          <BotonIcono
            accion={moverEjercicio}
            campos={{ id: item.id, rutina_id: rutinaId, direccion: "abajo" }}
            etiqueta="Bajar"
          >
            ↓
          </BotonIcono>
          <BotonIcono
            accion={quitarEjercicio}
            campos={{ id: item.id, rutina_id: rutinaId }}
            etiqueta="Quitar ejercicio"
          >
            ✕
          </BotonIcono>
        </div>
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-suave">
            <th scope="col" className="w-10 pb-1 font-medium">
              Serie
            </th>
            <th scope="col" className="pb-1 font-medium">
              Tipo
            </th>
            <th scope="col" className="w-20 pb-1 font-medium">
              Kg
            </th>
            <th scope="col" className="pb-1 font-medium">
              Reps
            </th>
            <th scope="col" className="w-11 pb-1">
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {item.series.map((s) => (
            <FilaSerieRutina
              key={s.id}
              serie={s}
              itemId={item.id}
              rutinaId={rutinaId}
            />
          ))}
        </tbody>
      </table>

      <form action={anadirSerieRutina} className="mt-2">
        <input type="hidden" name="item_id" value={item.id} />
        <input type="hidden" name="rutina_id" value={rutinaId} />
        <button
          type="submit"
          className="control h-11 w-full rounded-lg text-sm font-medium text-suave"
        >
          + Añadir serie
        </button>
      </form>

      <form action={accionItem} className="mt-4 space-y-3">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="rutina_id" value={rutinaId} />

        <div className="space-y-1.5">
          <label
            htmlFor={`nota-${item.id}`}
            className="block text-xs font-medium text-suave"
          >
            Nota del ejercicio
          </label>
          <input
            id={`nota-${item.id}`}
            name="nota"
            defaultValue={item.nota ?? ""}
            placeholder="Se ve durante el entreno"
            className="hundido h-11 w-full rounded-lg px-3 text-sm outline-none focus:border-accion"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor={`descanso-${item.id}`}
              className="block text-xs font-medium text-suave"
            >
              Descanso
            </label>
            <select
              id={`descanso-${item.id}`}
              name="descanso_segundos"
              defaultValue={item.descanso_segundos ?? ""}
              className="hundido h-11 rounded-lg px-3 text-sm"
            >
              <option value="">Sin temporizador</option>
              {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => (
                <option key={s} value={s}>
                  {s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="control h-11 rounded-lg px-4 text-sm font-medium"
          >
            Guardar
          </button>

          {estadoItem.error && (
            <span role="alert" className="text-sm text-error">
              {estadoItem.error}
            </span>
          )}
          {estadoItem.aviso && (
            <span role="status" className="text-sm text-exito">
              {estadoItem.aviso}
            </span>
          )}
        </div>
      </form>

      {puedeAgrupar && (
        <form action={alternarSuperset} className="mt-3">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="rutina_id" value={rutinaId} />
          <button
            type="submit"
            className="h-11 text-sm text-suave underline underline-offset-4"
          >
            {item.superset_grupo != null
              ? "Sacar de la superserie"
              : "Agrupar con el anterior en superserie"}
          </button>
        </form>
      )}
    </section>
  );
}

function FilaSerieRutina({
  serie,
  itemId,
  rutinaId,
}: {
  serie: ItemRutina["series"][number];
  itemId: string;
  rutinaId: string;
}) {
  const [estado, accion] = useActionState(actualizarSerieRutina, INICIAL);
  const idForm = `serie-rutina-${serie.id}`;

  return (
    <>
      <tr>
        <td className="py-0.5">
          <span className="inline-flex h-11 items-center text-xs text-suave tabular-nums">
            {serie.numero_serie}
          </span>
        </td>

        <td className="py-0.5 pr-2">
          <select
            form={idForm}
            name="tipo"
            defaultValue={serie.tipo}
            aria-label={`Tipo de la serie ${serie.numero_serie}`}
            className="hundido h-11 w-full rounded-md px-1.5 text-xs"
          >
            {TIPOS_SERIE.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </td>

        <td className="py-0.5 pr-2">
          <input
            form={idForm}
            name="peso_objetivo"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            defaultValue={serie.peso_objetivo ?? ""}
            placeholder="–"
            aria-label={`Peso objetivo de la serie ${serie.numero_serie}`}
            className="hundido h-11 w-full rounded-md px-1.5 text-center text-sm tabular-nums"
          />
        </td>

        {/* Reps como valor fijo o como rango (§5.1): dejar el segundo campo
            vacío es lo que significa "objetivo fijo". */}
        <td className="py-0.5 pr-2">
          <div className="flex items-center gap-1">
            <input
              form={idForm}
              name="reps_min"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={serie.reps_min ?? ""}
              placeholder="–"
              aria-label={`Repeticiones de la serie ${serie.numero_serie}`}
              className="hundido h-11 w-full rounded-md px-1.5 text-center text-sm tabular-nums"
            />
            <span className="text-xs text-suave">–</span>
            <input
              form={idForm}
              name="reps_max"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={serie.reps_max ?? ""}
              placeholder="máx"
              aria-label={`Tope del rango de repeticiones de la serie ${serie.numero_serie} (opcional)`}
              className="hundido h-11 w-full rounded-md px-1.5 text-center text-sm tabular-nums"
            />
          </div>
        </td>

        <td className="py-0.5">
          <div className="flex gap-1">
            <form id={idForm} action={accion}>
              <input type="hidden" name="id" value={serie.id} />
              <input type="hidden" name="rutina_id" value={rutinaId} />
              <button
                type="submit"
                aria-label={`Guardar la serie ${serie.numero_serie}`}
                className="control h-11 w-11 rounded-md text-sm"
              >
                ✓
              </button>
            </form>

            <form action={quitarSerieRutina}>
              <input type="hidden" name="id" value={serie.id} />
              <input type="hidden" name="item_id" value={itemId} />
              <input type="hidden" name="rutina_id" value={rutinaId} />
              <button
                type="submit"
                aria-label={`Quitar la serie ${serie.numero_serie}`}
                className="h-11 w-8 text-xs text-suave hover:text-error"
              >
                ✕
              </button>
            </form>
          </div>
        </td>
      </tr>

      {estado.error && (
        <tr>
          <td colSpan={5} className="pb-1">
            <p role="alert" className="text-xs text-error">
              {estado.error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function BotonIcono({
  accion,
  campos,
  etiqueta,
  desactivado,
  children,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  campos: Record<string, string>;
  etiqueta: string;
  desactivado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <form action={accion}>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        disabled={desactivado}
        aria-label={etiqueta}
        className="control h-11 w-11 rounded-lg text-sm disabled:opacity-40"
      >
        {children}
      </button>
    </form>
  );
}
