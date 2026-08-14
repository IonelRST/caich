"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  registrarPorChat,
  type EstadoChat,
} from "@/lib/datos/chat-acciones";

const ESTADO_INICIAL: EstadoChat = {};

const EJEMPLO =
  "hoy 78kg, comí pollo con arroz al mediodía, entrené pierna: sentadilla 80kg 4x8, prensa 120kg 3x10";

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Interpretando…" : "Registrar"}
    </button>
  );
}

export function FormularioChat() {
  const [estado, accion] = useActionState(registrarPorChat, ESTADO_INICIAL);

  return (
    <div className="space-y-5">
      <form action={accion} className="space-y-3">
        <label htmlFor="texto" className="block text-sm font-medium">
          Cuenta qué has hecho
        </label>
        {/*
          La `key` fuerza a React a remontar el campo cuando cambia lo que debe
          contener. La acción devuelve `texto` solo si quedó algo sin resolver:
          entonces se conserva para corregir sobre lo escrito, y si se guardó
          todo limpio vuelve vacío. Hacerlo así, y no vaciando el campo a mano
          tras el envío, evita depender del orden entre el re-render y el efecto.
        */}
        <textarea
          key={estado.texto ?? ""}
          id="texto"
          name="texto"
          rows={4}
          required
          defaultValue={estado.texto}
          placeholder={EJEMPLO}
          className="w-full resize-y rounded-lg border border-borde bg-transparent px-3 py-2 text-sm outline-none placeholder:text-suave focus:border-accion focus:ring-2 focus:ring-accion/40"
        />

        <div className="flex items-center gap-3">
          <BotonEnviar />
          {estado.error && (
            <span role="alert" className="text-sm text-error">
              {estado.error}
            </span>
          )}
        </div>
      </form>

      {estado.guardado && estado.guardado.length > 0 && (
        <section
          role="status"
          className="rounded-xl border border-borde bg-superficie p-5"
        >
          <h2 className="text-sm font-medium text-exito">Guardado</h2>
          <ul className="mt-3 space-y-1.5">
            {estado.guardado.map((linea, i) => (
              <li key={i} className="text-sm text-suave">
                {linea}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        §7.4: si algo no se ha entendido se dice explícitamente. Guardar dos de
        tres cosas y callarse es el peor resultado posible: el usuario cree que
        registró tres.
      */}
      {estado.dudas && estado.dudas.length > 0 && (
        <section className="rounded-xl border border-borde bg-superficie p-5">
          <h2 className="text-sm font-medium text-aviso">Falta aclarar</h2>
          <ul className="mt-3 space-y-1.5">
            {estado.dudas.map((duda, i) => (
              <li key={i} className="text-sm text-suave">
                {duda}
              </li>
            ))}
          </ul>
        </section>
      )}

      {estado.ejerciciosDesconocidos &&
        estado.ejerciciosDesconocidos.length > 0 && (
          <section className="rounded-xl border border-borde bg-superficie p-5">
            <h2 className="text-sm font-medium text-aviso">
              Ejercicios sin reconocer
            </h2>
            <p className="mt-2 text-sm text-suave">
              No están en el catálogo, así que ese entreno se ha guardado sin
              ellos. Puede que sean otra forma de nombrar uno que ya existe:
              añádelos desde una rutina si de verdad son nuevos.
            </p>
            <ul className="mt-3 space-y-1.5">
              {estado.ejerciciosDesconocidos.map((nombre) => (
                <li key={nombre} className="text-sm">
                  {nombre}
                </li>
              ))}
            </ul>
          </section>
        )}
    </div>
  );
}
