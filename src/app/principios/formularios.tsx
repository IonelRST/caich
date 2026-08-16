"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AMBITOS, ETIQUETA_AMBITO } from "@/lib/ia/principios";
import {
  generarPrincipios,
  guardarPrincipio,
  type EstadoPrincipios,
} from "@/lib/datos/principios-acciones";

const ESTADO_INICIAL: EstadoPrincipios = {};

function Boton({ texto, ocupado }: { texto: string; ocupado: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? ocupado : texto}
    </button>
  );
}

function Mensajes({ estado }: { estado: EstadoPrincipios }) {
  return (
    <>
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
    </>
  );
}

export function BotonGenerar() {
  const [estado, accion] = useActionState(
    () => generarPrincipios(),
    ESTADO_INICIAL,
  );

  return (
    <form action={accion} className="flex flex-wrap items-center gap-3">
      <Boton texto="Redactar borrador con IA" ocupado="Redactando…" />
      <Mensajes estado={estado} />
    </form>
  );
}

export function FormularioPrincipio() {
  const [estado, accion] = useActionState(guardarPrincipio, ESTADO_INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="control rounded-lg px-4 py-2 text-sm"
      >
        Añadir uno a mano
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="alzado space-y-3 rounded-xl p-5"
    >
      <div className="space-y-1.5">
        <label htmlFor="enunciado" className="block text-sm font-medium">
          Enunciado
        </label>
        <textarea
          id="enunciado"
          name="enunciado"
          rows={3}
          required
          minLength={20}
          className="hundido w-full resize-y rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
        />
      </div>

      <div className="w-52 space-y-1.5">
        <label htmlFor="ambito" className="block text-sm font-medium">
          Ámbito
        </label>
        <select
          id="ambito"
          name="ambito"
          className="hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
        >
          {AMBITOS.map((a) => (
            <option key={a} value={a}>
              {ETIQUETA_AMBITO[a]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Boton texto="Guardar" ocupado="Guardando…" />
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-sm text-suave underline underline-offset-4"
        >
          Cancelar
        </button>
        <Mensajes estado={estado} />
      </div>
    </form>
  );
}
