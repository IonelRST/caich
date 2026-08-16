"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  pedirNivel23,
  type EstadoNivel23,
} from "@/lib/datos/insights-acciones";

const ESTADO_INICIAL: EstadoNivel23 = {};

const ETIQUETA_FUERZA: Record<string, string> = {
  debil: "señal débil",
  moderada: "señal moderada",
  fuerte: "señal fuerte",
};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Leyendo tus datos…" : "Pedir lectura"}
    </button>
  );
}

export function Nivel23() {
  const [estado, accion] = useActionState(
    () => pedirNivel23(),
    ESTADO_INICIAL,
  );

  const r = estado.resultado;

  return (
    <div className="space-y-5">
      <form action={accion} className="flex flex-wrap items-center gap-3">
        <Boton />
        {estado.error && (
          <span role="alert" className="text-sm text-error">
            {estado.error}
          </span>
        )}
      </form>

      {r?.nota && <p className="text-sm text-suave">{r.nota}</p>}

      {r && r.nivel2.length > 0 && (
        <section>
          <h3 className="text-sm font-medium">Relaciones y sugerencias</h3>
          <ul className="mt-3 space-y-3">
            {r.nivel2.map((i, n) => (
              <li
                key={n}
                className="alzado rounded-xl p-4"
              >
                <p className="text-sm">{i.afirmacion}</p>

                {/* §11.2: los datos que lo sostienen se muestran, no solo la
                    conclusión, para que se pueda verificar. */}
                <p className="mt-2 text-sm text-suave">{i.datosDeRespaldo}</p>

                {/* §11.3: el razonamiento se muestra para poder discrepar de
                    él, no solo del número. */}
                <div className="mt-3 border-t border-borde pt-3">
                  <p className="text-xs text-suave">Se apoya en:</p>
                  <p className="mt-1 text-xs">{i.apoyo}</p>
                  <p className="mt-2 text-xs text-suave">
                    {i.muestras} registros · {ETIQUETA_FUERZA[i.fuerza] ?? i.fuerza}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.nivel3.length > 0 && (
        <section>
          <h3 className="text-sm font-medium">Observaciones sin conclusión</h3>
          <p className="mt-2 text-sm text-suave">
            Patrones vistos en tus propios datos. No afirman una causa: son n=1,
            con confusores que la app no puede descartar. Para cualquier decisión
            sobre esto, un entrenador, nutricionista o médico.
          </p>
          <ul className="mt-3 space-y-3">
            {r.nivel3.map((o, n) => (
              <li
                key={n}
                className="alzado rounded-xl p-4"
              >
                <p className="text-sm">{o.observacion}</p>
                <p className="mt-2 text-sm text-suave">{o.datosDeRespaldo}</p>
                {o.degradado && (
                  <p className="mt-3 border-t border-borde pt-3 text-xs text-aviso">
                    Venía como conclusión, pero no decía en qué se apoyaba: se
                    queda en observación.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {r && r.nivel2.length === 0 && r.nivel3.length === 0 && !r.nota && (
        <p className="text-sm text-suave">
          No hay nada destacable en tus datos ahora mismo.
        </p>
      )}
    </div>
  );
}
