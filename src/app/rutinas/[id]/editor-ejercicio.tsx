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
  etiquetasDeSerie,
  type ItemRutina,
} from "@/lib/datos/entrenos";

const INICIAL: EstadoRutina = {};

/** Etiquetas cortas, solo para el selector de la tabla. La tabla es estrecha y
 *  "Calentamiento" la desborda; el nombre largo va en el `aria-label`. */
const CORTAS: Record<string, string> = {
  normal: "Normal",
  calentamiento: "Calent.",
  fallo: "Fallo",
  descendente: "Desc.",
};

const claseCelda =
  "hundido h-10 w-full min-w-0 rounded-md px-1.5 text-center text-base tabular-nums outline-none focus:border-accion";

/** Guarda al salir del campo, como Hevy: aquí no hay botón de guardar. */
function guardarAlSalir(e: { currentTarget: { form: HTMLFormElement | null } }) {
  e.currentTarget.form?.requestSubmit();
}

/**
 * Un ejercicio del constructor de rutinas (§5.1).
 *
 * La tabla replica la de la sesión en vivo: el tipo de serie se lee en la
 * columna SERIE como número más sigla (§5.2), no en una columna aparte. Antes
 * el tipo vivía en un desplegable tan estrecho que solo se veía la flecha, así
 * que una serie de calentamiento era indistinguible de una normal.
 *
 * No hay botones de guardar por fila. Los valores se guardan al salir del
 * campo, que es lo que hace la referencia: un ✓ por serie en una plantilla no
 * significa nada y compite visualmente con el ✓ de completar de la sesión.
 *
 * Esta pantalla no es la sesión en vivo: se usa sentado y con calma, así que
 * los controles del ejercicio mantienen los 44px de la §21.7. La excepción de
 * densidad es solo para las filas de la tabla.
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
  const etiquetas = etiquetasDeSerie(item.series.map((s) => s.tipo));

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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold tracking-tight text-accion">
            {item.ejercicio.nombre_canonico}
          </h3>
          {item.superset_grupo != null && (
            <p className="mt-0.5 text-xs font-medium text-suave">
              Superserie {etiquetaSuperset(item.superset_grupo)}
            </p>
          )}
        </div>

        {/*
          Sin relieve: son controles secundarios y en relieve competían con la
          tabla, que es lo que se viene a mirar. Quitar va aparte y en rojo al
          tocarlo — reordenar y destruir no pueden pesar lo mismo.
        */}
        <div className="flex shrink-0 items-center">
          <BotonIcono
            accion={moverEjercicio}
            campos={{ id: item.id, rutina_id: rutinaId, direccion: "arriba" }}
            etiqueta="Subir el ejercicio"
            desactivado={!puedeSubir}
          >
            ↑
          </BotonIcono>
          <BotonIcono
            accion={moverEjercicio}
            campos={{ id: item.id, rutina_id: rutinaId, direccion: "abajo" }}
            etiqueta="Bajar el ejercicio"
          >
            ↓
          </BotonIcono>
          <BotonIcono
            accion={quitarEjercicio}
            campos={{ id: item.id, rutina_id: rutinaId }}
            etiqueta="Quitar el ejercicio de la rutina"
            destructivo
          >
            ✕
          </BotonIcono>
        </div>
      </div>

      {/*
        `table-fixed` con proporciones explícitas: sin ellas, las columnas se
        repartían por el contenido y las cabeceras dejaban de caer sobre su
        columna. El reparto no cambia con el ancho, así que la tabla se lee
        igual en móvil y en escritorio.
      */}
      <table className="mt-3 w-full table-fixed border-separate border-spacing-y-1 text-sm">
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[20%]" />
          <col className="w-[42%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-suave">
            <th scope="col" className="pr-2 text-left font-medium">
              Serie
            </th>
            <th scope="col" className="pr-2 text-center font-medium">
              Kg
            </th>
            <th scope="col" className="pr-2 text-center font-medium">
              Reps
            </th>
            <th scope="col">
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {item.series.map((s, i) => (
            <FilaSerieRutina
              key={s.id}
              serie={s}
              etiqueta={etiquetas[i]}
              itemId={item.id}
              rutinaId={rutinaId}
            />
          ))}
        </tbody>
      </table>

      <form action={anadirSerieRutina} className="mt-1">
        <input type="hidden" name="item_id" value={item.id} />
        <input type="hidden" name="rutina_id" value={rutinaId} />
        <button
          type="submit"
          className="h-11 w-full rounded-lg text-sm font-medium text-suave hover:bg-fondo hover:text-texto"
        >
          + Añadir serie
        </button>
      </form>

      <form
        action={accionItem}
        className="mt-3 space-y-2 border-t border-borde pt-3"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="rutina_id" value={rutinaId} />

        <input
          name="nota"
          defaultValue={item.nota ?? ""}
          onBlur={guardarAlSalir}
          placeholder="Nota del ejercicio, visible durante el entreno"
          aria-label="Nota del ejercicio"
          className="h-10 w-full rounded-md bg-transparent text-sm text-suave outline-none placeholder:text-suave/70 focus:text-texto"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={`descanso-${item.id}`}
            className="text-xs font-medium text-suave"
          >
            Descanso
          </label>
          <select
            id={`descanso-${item.id}`}
            name="descanso_segundos"
            defaultValue={item.descanso_segundos ?? ""}
            onChange={guardarAlSalir}
            className="hundido h-10 rounded-md px-2 text-sm"
          >
            <option value="">Sin temporizador</option>
            {[30, 45, 60, 90, 120, 150, 180, 240, 300].map((s) => (
              <option key={s} value={s}>
                {s < 60
                  ? `${s} s`
                  : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`}
              </option>
            ))}
          </select>

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
        <form action={alternarSuperset} className="mt-1">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="rutina_id" value={rutinaId} />
          <button
            type="submit"
            className="h-11 text-sm text-suave underline underline-offset-4 hover:text-texto"
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
  etiqueta,
  itemId,
  rutinaId,
}: {
  serie: ItemRutina["series"][number];
  etiqueta: { numero: string; sigla: string };
  itemId: string;
  rutinaId: string;
}) {
  const [estado, accion] = useActionState(actualizarSerieRutina, INICIAL);
  const idForm = `serie-rutina-${serie.id}`;

  return (
    <>
      <tr>
        {/*
          Columna SERIE: número y sigla como en la sesión en vivo, más el
          selector de tipo. El número lo calcula `etiquetasDeSerie`, así que un
          calentamiento no consume número de serie de trabajo.
        */}
        <td className="pr-2">
          {/*
            Número y sigla ocupan hueco fijo aunque estén vacíos. Pintarlos solo
            cuando existen desalineaba la columna entera: sin sigla, el selector
            se corría a la izquierda y ninguna fila cuadraba con la siguiente.
          */}
          <div className="flex items-center gap-1">
            <span className="w-3 shrink-0 text-right text-xs tabular-nums text-suave">
              {etiqueta.numero}
            </span>
            <span
              aria-hidden={!etiqueta.sigla}
              className="w-2.5 shrink-0 text-center text-[10px] font-semibold text-aviso"
            >
              {etiqueta.sigla}
            </span>
            <select
              form={idForm}
              name="tipo"
              defaultValue={serie.tipo}
              onChange={guardarAlSalir}
              aria-label={`Tipo de la serie ${serie.numero_serie}`}
              className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-0.5 text-[11px] text-suave outline-none focus:text-texto sm:text-xs"
            >
              {TIPOS_SERIE.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {CORTAS[t.valor] ?? t.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </td>

        <td className="pr-2">
          <input
            form={idForm}
            name="peso_objetivo"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            defaultValue={serie.peso_objetivo ?? ""}
            placeholder="–"
            onBlur={guardarAlSalir}
            aria-label={`Peso objetivo de la serie ${serie.numero_serie}`}
            className={claseCelda}
          />
        </td>

        {/* Reps como valor fijo o como rango (§5.1): dejar el segundo campo
            vacío es lo que significa "objetivo fijo". */}
        <td className="pr-2">
          <div className="flex items-center gap-1">
            <input
              form={idForm}
              name="reps_min"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={serie.reps_min ?? ""}
              placeholder="–"
              onBlur={guardarAlSalir}
              aria-label={`Repeticiones de la serie ${serie.numero_serie}`}
              className={claseCelda}
            />
            <span aria-hidden="true" className="text-xs text-suave">
              –
            </span>
            <input
              form={idForm}
              name="reps_max"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={serie.reps_max ?? ""}
              placeholder="–"
              onBlur={guardarAlSalir}
              aria-label={`Tope del rango de repeticiones de la serie ${serie.numero_serie} (opcional)`}
              className={claseCelda}
            />
          </div>
        </td>

        <td>
          {/* El formulario de la fila no tiene botón: lo dispara `onBlur`. */}
          <form id={idForm} action={accion} className="hidden">
            <input type="hidden" name="id" value={serie.id} />
            <input type="hidden" name="rutina_id" value={rutinaId} />
          </form>

          <form action={quitarSerieRutina}>
            <input type="hidden" name="id" value={serie.id} />
            <input type="hidden" name="item_id" value={itemId} />
            <input type="hidden" name="rutina_id" value={rutinaId} />
            <button
              type="submit"
              aria-label={`Quitar la serie ${serie.numero_serie}`}
              className="h-10 w-7 text-xs text-suave hover:text-error"
            >
              ✕
            </button>
          </form>
        </td>
      </tr>

      {estado.error && (
        <tr>
          <td colSpan={4}>
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
  destructivo,
  children,
}: {
  accion: (formData: FormData) => void | Promise<void>;
  campos: Record<string, string>;
  etiqueta: string;
  desactivado?: boolean;
  destructivo?: boolean;
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
        className={`h-11 w-11 rounded-lg text-sm text-suave disabled:opacity-30 ${
          destructivo ? "hover:bg-error/10 hover:text-error" : "hover:bg-fondo hover:text-texto"
        }`}
      >
        {children}
      </button>
    </form>
  );
}
