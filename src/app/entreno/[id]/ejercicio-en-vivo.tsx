"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  borrarSerie,
  registrarSerie,
  type EstadoRutina,
} from "@/lib/datos/entrenos-acciones";
import type { SerieAnterior, SerieRegistrada } from "@/lib/datos/entrenos";

const INICIAL: EstadoRutina = {};

/**
 * Un ejercicio dentro de la sesión en vivo.
 *
 * Todo se maneja con steppers y no con teclado: esta pantalla se usa de pie,
 * con una mano y con prisa (§5.2). Los objetivos táctiles son grandes a
 * propósito — un botón pequeño es inservible con las manos sudadas.
 */
export function EjercicioEnVivo({
  entrenoId,
  entrenoEjercicioId,
  nombre,
  seriesObjetivo,
  repsObjetivo,
  pesoObjetivo,
  seriesHechas,
  anterior,
}: {
  entrenoId: string;
  entrenoEjercicioId: string;
  nombre: string;
  seriesObjetivo: number | null;
  repsObjetivo: number | null;
  pesoObjetivo: number | null;
  seriesHechas: (SerieRegistrada & { id: string })[];
  anterior: SerieAnterior | null;
}) {
  // Se arranca con lo de la última vez si existe; si no, con el objetivo de la
  // rutina. Así lo normal es tocar "Guardar serie" sin ajustar nada.
  const [peso, setPeso] = useState<number>(
    anterior?.peso ?? pesoObjetivo ?? 20,
  );
  const [reps, setReps] = useState<number>(
    anterior?.repeticiones ?? repsObjetivo ?? 8,
  );

  const [estado, accion] = useActionState(registrarSerie, INICIAL);

  const siguienteSerie = seriesHechas.length + 1;
  const completado =
    seriesObjetivo != null && seriesHechas.length >= seriesObjetivo;

  return (
    <section className="rounded-xl border border-borde p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium">{nombre}</h2>
        <span className="shrink-0 text-xs text-suave">
          {seriesHechas.length}
          {seriesObjetivo != null && `/${seriesObjetivo}`} series
        </span>
      </div>

      {anterior && (
        <p className="mt-1 text-xs text-suave">
          Última vez: {anterior.peso ?? "–"} kg × {anterior.repeticiones ?? "–"}
        </p>
      )}

      {seriesHechas.length > 0 && (
        <ul className="mt-3 space-y-1">
          {seriesHechas.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-superficie px-3 py-1.5 text-sm"
            >
              <span>
                <span className="text-suave">
                  {s.numero_serie}.
                </span>{" "}
                {s.peso} kg × {s.repeticiones}
              </span>
              <form action={borrarSerie}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="entreno_id" value={entrenoId} />
                <button
                  type="submit"
                  aria-label={`Borrar serie ${s.numero_serie}`}
                  className="rounded px-2 py-0.5 text-xs text-suave hover:text-error"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={accion} className={`mt-4 ${completado ? "opacity-60" : ""}`}>
        <input
          type="hidden"
          name="entreno_ejercicio_id"
          value={entrenoEjercicioId}
        />
        <input type="hidden" name="entreno_id" value={entrenoId} />
        <input type="hidden" name="numero_serie" value={siguienteSerie} />
        <input type="hidden" name="peso" value={peso} />
        <input type="hidden" name="repeticiones" value={reps} />

        <div className="grid grid-cols-2 gap-3">
          <Stepper
            etiqueta="Peso (kg)"
            valor={peso}
            paso={2.5}
            minimo={0}
            onCambio={setPeso}
          />
          <Stepper
            etiqueta="Reps"
            valor={reps}
            paso={1}
            minimo={0}
            onCambio={setReps}
          />
        </div>

        <BotonSerie numero={siguienteSerie} />

        {estado.error && (
          <p
            role="alert"
            className="mt-2 text-sm text-error"
          >
            {estado.error}
          </p>
        )}
      </form>
    </section>
  );
}

function Stepper({
  etiqueta,
  valor,
  paso,
  minimo,
  onCambio,
}: {
  etiqueta: string;
  valor: number;
  paso: number;
  minimo: number;
  onCambio: (v: number) => void;
}) {
  const ajustar = (delta: number) =>
    onCambio(Math.max(minimo, Math.round((valor + delta) * 10) / 10));

  return (
    <div>
      <p className="text-xs font-medium text-suave">
        {etiqueta}
      </p>
      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => ajustar(-paso)}
          aria-label={`Bajar ${etiqueta}`}
          className="h-14 w-14 shrink-0 rounded-lg border border-borde text-2xl leading-none"
        >
          −
        </button>
        <output className="flex-1 text-center font-cifra text-4xl font-semibold tabular-nums">
          {valor}
        </output>
        <button
          type="button"
          onClick={() => ajustar(paso)}
          aria-label={`Subir ${etiqueta}`}
          className="h-14 w-14 shrink-0 rounded-lg border border-borde text-2xl leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

function BotonSerie({ numero }: { numero: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 h-14 w-full rounded-lg bg-accion text-base font-medium text-sobre-accion disabled:opacity-50"
    >
      {pending ? "Guardando…" : `Guardar serie ${numero}`}
    </button>
  );
}
