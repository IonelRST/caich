"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  aceptarSugerencia,
  descartarSugerencia,
  type Sugerencia,
} from "@/lib/datos/biblioteca-acciones";
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
          className="hundido w-full resize-y rounded-lg px-3 py-2 text-sm outline-none placeholder:text-suave focus:border-accion focus:ring-2 focus:ring-accion/40"
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
          className="alzado rounded-xl p-5"
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

      {/* §6.6: lo que se repite se ofrece para la biblioteca. Ofrecer, no
          guardar: una biblioteca que se llena sola deja de ser tuya. */}
      {estado.sugerencias?.map((s) => (
        <OfertaBiblioteca key={s.clave} sugerencia={s} />
      ))}

      {/*
        §7.4: si algo no se ha entendido se dice explícitamente. Guardar dos de
        tres cosas y callarse es el peor resultado posible: el usuario cree que
        registró tres.
      */}
      {estado.dudas && estado.dudas.length > 0 && (
        <section className="alzado rounded-xl p-5">
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
          <section className="alzado rounded-xl p-5">
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

/**
 * Oferta de guardar una comida repetida en la biblioteca (§6.6).
 *
 * Desaparece en cuanto se responde, en el cliente: la respuesta ya está tomada
 * y dejar la tarjeta en pantalla invitaría a pulsar dos veces.
 */
function OfertaBiblioteca({ sugerencia }: { sugerencia: Sugerencia }) {
  const [resuelto, setResuelto] = useState<string | null>(null);

  if (resuelto) {
    return (
      <p role="status" className="text-sm text-suave">
        {resuelto}
      </p>
    );
  }

  return (
    <section className="alzado rounded-xl p-5">
      <h2 className="text-sm font-medium">¿Lo guardo en tu biblioteca?</h2>
      <p className="mt-2 text-sm text-suave">
        Has registrado <strong className="font-medium text-texto">{sugerencia.nombre}</strong>{" "}
        más de una vez. Guardado, se registra de un toque desde Dieta.
      </p>
      {sugerencia.cantidad && (
        <p className="mt-1 text-xs text-suave">{sugerencia.cantidad}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <form
          action={async (formData: FormData) => {
            const r = await aceptarSugerencia(formData);
            setResuelto(r.error ?? r.aviso ?? null);
          }}
        >
          <input type="hidden" name="nombre" value={sugerencia.nombre} />
          <input type="hidden" name="cantidad" value={sugerencia.cantidad} />
          <input
            type="hidden"
            name="calorias"
            value={sugerencia.calorias ?? ""}
          />
          <input
            type="hidden"
            name="proteina_g"
            value={sugerencia.proteina_g ?? ""}
          />
          <button
            type="submit"
            className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion shadow-apoyado"
          >
            Guardar
          </button>
        </form>

        <form
          action={async (formData: FormData) => {
            const r = await descartarSugerencia(formData);
            setResuelto(r.error ?? r.aviso ?? null);
          }}
        >
          <input type="hidden" name="clave" value={sugerencia.clave} />
          <button
            type="submit"
            className="rounded-lg px-4 py-2 text-sm text-suave underline underline-offset-4"
          >
            No, gracias
          </button>
        </form>
      </div>
    </section>
  );
}
