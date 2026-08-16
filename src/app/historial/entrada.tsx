"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  actualizarComidaRegistrada,
  borrarComidaRegistrada,
  type EstadoDieta,
} from "@/lib/datos/dieta-acciones";
import { borrarEntreno } from "@/lib/datos/entrenos-acciones";
import { MEDIDAS_HABITUALES } from "@/lib/datos/medidas";
import {
  actualizarMedida,
  borrarMedida,
  type EstadoMedida,
} from "@/lib/datos/medidas-acciones";

/**
 * Una fila del historial (§8), con edición además de borrado.
 *
 * La edición faltaba para todo, y la única salida era borrar y volver a crear:
 * eso cambia `fecha_registro` y pierde el enlace con el mensaje original, así
 * que corregir una errata costaba dos datos de trazabilidad.
 *
 * El entreno no se edita desde aquí a propósito: sus valores viven en sus
 * series, y la pantalla que las edita es la sesión (§5.2). Un formulario que
 * dijera "Entreno · 12 series" no podría corregir ninguna de ellas.
 */

export type DatosMedida = {
  nombre: string;
  valor: number;
  unidad: string;
  fecha: string;
};

export type DatosComida = {
  descripcion: string;
  cantidad: string | null;
  calorias: number | null;
  proteina_g: number | null;
  fecha: string;
};

export type EntradaHistorial = {
  id: string;
  tipo: "medida" | "entreno" | "comida";
  fecha: string;
  titulo: string;
  detalle: string;
  medida?: DatosMedida;
  comida?: DatosComida;
};

const INICIAL_MEDIDA: EstadoMedida = {};
const INICIAL_COMIDA: EstadoDieta = {};

const claseCampo =
  "hundido w-full rounded-lg px-2 py-1.5 text-sm outline-none focus:border-accion";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-3 py-1.5 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Guardar"}
    </button>
  );
}

export function Entrada({
  entrada,
  fechaLegible,
}: {
  entrada: EntradaHistorial;
  fechaLegible: string;
}) {
  const [editando, setEditando] = useState(false);
  const editable = entrada.tipo !== "entreno";

  const borrado =
    entrada.tipo === "medida"
      ? borrarMedida
      : entrada.tipo === "comida"
        ? borrarComidaRegistrada
        : borrarEntreno;

  if (editando && entrada.medida) {
    return (
      <li className="py-3">
        <FormularioMedida
          id={entrada.id}
          datos={entrada.medida}
          alTerminar={() => setEditando(false)}
        />
      </li>
    );
  }

  if (editando && entrada.comida) {
    return (
      <li className="py-3">
        <FormularioComida
          id={entrada.id}
          datos={entrada.comida}
          alTerminar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {entrada.titulo}{" "}
          <span className="font-normal text-suave">{entrada.detalle}</span>
        </p>
        <p className="text-xs text-suave">{fechaLegible}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {editable && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-lg px-2 py-1 text-xs text-suave hover:bg-fondo hover:text-texto"
          >
            Editar
          </button>
        )}

        <form action={borrado}>
          <input type="hidden" name="id" value={entrada.id} />
          <button
            type="submit"
            className="rounded-lg px-2 py-1 text-xs text-suave hover:bg-error/10 hover:text-error"
          >
            Borrar
          </button>
        </form>
      </div>
    </li>
  );
}

function FormularioMedida({
  id,
  datos,
  alTerminar,
}: {
  id: string;
  datos: DatosMedida;
  alTerminar: () => void;
}) {
  const [estado, accion] = useActionState(actualizarMedida, INICIAL_MEDIDA);

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="unidad" value={datos.unidad} />

      <div className="flex flex-wrap gap-2">
        <select
          name="nombre"
          defaultValue={datos.nombre}
          aria-label="Qué se mide"
          className={`${claseCampo} w-40`}
        >
          {MEDIDAS_HABITUALES.map((m) => (
            <option key={m.nombre} value={m.nombre}>
              {m.etiqueta}
            </option>
          ))}
          {!MEDIDAS_HABITUALES.some((m) => m.nombre === datos.nombre) && (
            <option value={datos.nombre}>{datos.nombre}</option>
          )}
        </select>

        <input
          name="valor"
          type="number"
          step="0.1"
          min="0"
          defaultValue={datos.valor}
          aria-label="Valor"
          className={`${claseCampo} w-24 tabular-nums`}
        />

        <input
          name="fecha"
          type="date"
          defaultValue={datos.fecha}
          aria-label="Fecha"
          className={`${claseCampo} w-40`}
        />
      </div>

      <Acciones estado={estado} alTerminar={alTerminar} />
    </form>
  );
}

function FormularioComida({
  id,
  datos,
  alTerminar,
}: {
  id: string;
  datos: DatosComida;
  alTerminar: () => void;
}) {
  const [estado, accion] = useActionState(
    actualizarComidaRegistrada,
    INICIAL_COMIDA,
  );

  return (
    <form action={accion} className="space-y-2">
      <input type="hidden" name="id" value={id} />

      <input
        name="descripcion"
        defaultValue={datos.descripcion}
        aria-label="Qué comiste"
        className={claseCampo}
      />

      <div className="flex flex-wrap gap-2">
        <input
          name="cantidad"
          defaultValue={datos.cantidad ?? ""}
          placeholder="Cantidad"
          aria-label="Cantidad"
          className={`${claseCampo} w-44`}
        />
        <input
          name="calorias"
          type="number"
          min="0"
          defaultValue={datos.calorias ?? ""}
          placeholder="kcal"
          aria-label="Calorías"
          className={`${claseCampo} w-24 tabular-nums`}
        />
        <input
          name="proteina_g"
          type="number"
          min="0"
          step="0.1"
          defaultValue={datos.proteina_g ?? ""}
          placeholder="prot."
          aria-label="Proteína en gramos"
          className={`${claseCampo} w-24 tabular-nums`}
        />
        <input
          name="fecha"
          type="date"
          defaultValue={datos.fecha}
          aria-label="Fecha"
          className={`${claseCampo} w-40`}
        />
      </div>

      <Acciones estado={estado} alTerminar={alTerminar} />
    </form>
  );
}

function Acciones({
  estado,
  alTerminar,
}: {
  estado: { error?: string; aviso?: string };
  alTerminar: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <BotonGuardar />
      <button
        type="button"
        onClick={alTerminar}
        className="text-sm text-suave underline underline-offset-4"
      >
        Cancelar
      </button>
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
    </div>
  );
}
