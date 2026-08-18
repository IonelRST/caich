"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { DIAS, MOMENTOS } from "@/lib/datos/dieta";
import {
  anadirComidaAlPlan,
  registrarCheckin,
  type EstadoDieta,
} from "@/lib/datos/dieta-acciones";

const INICIAL: EstadoDieta = {};

const claseCampo =
  "hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

function Boton({ texto, cargando }: { texto: string; cargando: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? cargando : texto}
    </button>
  );
}

export function FormularioComidaPlan({
  diaActual,
  biblioteca,
}: {
  diaActual: number;
  biblioteca: { id: string; nombre: string }[];
}) {
  const [estado, accion] = useActionState(anadirComidaAlPlan, INICIAL);

  if (biblioteca.length === 0) {
    return (
      <p className="mt-4 text-sm text-suave">
        El plan coloca comidas de tu biblioteca en días concretos. Guarda alguna
        arriba y vuelve aquí.
      </p>
    );
  }

  return (
    <form action={accion} className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="w-36 space-y-1.5">
          <label htmlFor="dia_semana" className="block text-sm font-medium">
            Día
          </label>
          <select
            id="dia_semana"
            name="dia_semana"
            defaultValue={diaActual}
            className={claseCampo}
          >
            {DIAS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40 space-y-1.5">
          <label htmlFor="momento_dia" className="block text-sm font-medium">
            Momento
          </label>
          <select id="momento_dia" name="momento_dia" className={claseCampo}>
            {MOMENTOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* §6.4: el plan coloca comidas que ya existen en la biblioteca. Antes se
          reescribían aquí, así que la misma comida vivía en dos sitios y
          corregirla en uno no la corregía en el otro. */}
      <div className="space-y-1.5">
        <label htmlFor="comida_guardada_id" className="block text-sm font-medium">
          Qué comida
        </label>
        <select
          id="comida_guardada_id"
          name="comida_guardada_id"
          required
          className={claseCampo}
        >
          {biblioteca.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Boton texto="Añadir al plan" cargando="Añadiendo…" />
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

export function CheckinComida({
  itemId,
  descripcion,
  cantidad,
  momento,
  yaRegistrada,
}: {
  itemId: string;
  descripcion: string;
  cantidad: string | null;
  momento: string | null;
  yaRegistrada: boolean;
}) {
  const [estado, accion] = useActionState(registrarCheckin, INICIAL);
  const [adherencia, setAdherencia] = useState("igual");
  const [detalle, setDetalle] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  /*
   * React resetea el formulario cuando la acción termina, y el reset devuelve
   * los radios al estado inicial del HTML — "igual". El estado de React seguía
   * en "menos", así que la interfaz mostraba "Menos" resaltado mientras el DOM
   * enviaba "igual": el usuario creía registrar una desviación y registraba
   * adherencia perfecta, que es justo el dato que la §6.3 declara imprescindible.
   *
   * Se vuelve a aplicar la elección al DOM después de cada resultado.
   */
  useEffect(() => {
    const f = formRef.current;
    if (!f) return;
    const radio = f.querySelector<HTMLInputElement>(
      `input[name="adherencia"][value="${adherencia}"]`,
    );
    if (radio) radio.checked = true;
    const campo = f.querySelector<HTMLInputElement>('input[name="detalle"]');
    if (campo) campo.value = detalle;
  }, [estado, adherencia, detalle]);

  // §6.3: la desviación exige detalle. Se pide solo cuando hace falta, para no
  // cobrar ese peaje en el caso normal (que es seguir el plan).
  const necesitaDetalle = adherencia === "mas" || adherencia === "menos" || adherencia === "otra";

  if (yaRegistrada) {
    return (
      <li className="alzado rounded-xl p-4 opacity-60">
        <p className="text-sm font-medium">
          {momento}: {descripcion}
        </p>
        <p className="mt-1 text-xs text-exito">
          Ya registrada hoy.
        </p>
      </li>
    );
  }

  return (
    <li className="alzado rounded-xl p-4">
      <p className="text-sm font-medium">
        {momento}: {descripcion}
      </p>
      {cantidad && (
        <p className="mt-0.5 text-xs text-suave">
          {cantidad}
        </p>
      )}

      <form ref={formRef} action={accion} className="mt-3 space-y-3">
        <input type="hidden" name="plantilla_item_id" value={itemId} />

        <div className="flex flex-wrap gap-2">
          {[
            { valor: "igual", texto: "Igual que el plan" },
            { valor: "mas", texto: "Más" },
            { valor: "menos", texto: "Menos" },
            { valor: "otra", texto: "Otra cosa" },
            { valor: "omitida", texto: "No la comí" },
          ].map((o) => (
            <label
              key={o.valor}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                adherencia === o.valor
                  ? "border-accion bg-accion text-sobre-accion"
                  : "border-borde"
              }`}
            >
              <input
                type="radio"
                name="adherencia"
                value={o.valor}
                checked={adherencia === o.valor}
                onChange={(e) => setAdherencia(e.target.value)}
                className="sr-only"
              />
              {o.texto}
            </label>
          ))}
        </div>

        {necesitaDetalle && (
          <div className="space-y-1.5">
            <label htmlFor={`detalle-${itemId}`} className="block text-sm font-medium">
              ¿Cuánto exactamente?
            </label>
            <input
              id={`detalle-${itemId}`}
              name="detalle"
              required
              maxLength={200}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              placeholder="el doble de arroz, unos 200 g"
              className={claseCampo}
            />
            <p className="text-xs text-suave">
              Sin esto, la desviación no explica nada después.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Boton texto="Registrar" cargando="Guardando…" />
          {estado.error && (
            <span role="alert" className="text-sm text-error">
              {estado.error}
            </span>
          )}
        </div>
      </form>
    </li>
  );
}
