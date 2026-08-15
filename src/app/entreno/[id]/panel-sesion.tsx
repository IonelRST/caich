"use client";

import { useCallback, useEffect, useState } from "react";
import { EjercicioEnVivo } from "./ejercicio-en-vivo";
import { Temporizador } from "./temporizador";
import {
  anadirEjercicioSesion,
  descartarSesion,
  terminarSesion,
} from "@/lib/datos/entrenos-acciones";
import {
  volumenDeSerie,
  type Ejercicio,
  type SerieAnterior,
  type SerieRegistrada,
} from "@/lib/datos/entrenos";

export type EjercicioSesion = {
  id: string;
  nombre: string;
  nota: string | null;
  descanso_segundos: number | null;
  superset_grupo: number | null;
  series: SerieRegistrada[];
  anteriores: [number, SerieAnterior][];
};

/**
 * La sesión en vivo entera (§5.2).
 *
 * El temporizador vive aquí y no dentro de cada ejercicio porque solo hay un
 * descanso a la vez: si cada ejercicio tuviera el suyo, marcar una serie
 * mientras corre otro descanso dejaría dos cuentas atrás compitiendo.
 */
export function PanelSesion({
  entrenoId,
  inicio,
  ejercicios,
  catalogo,
  completado,
}: {
  entrenoId: string;
  inicio: string;
  ejercicios: EjercicioSesion[];
  catalogo: Ejercicio[];
  completado: boolean;
}) {
  const [descanso, setDescanso] = useState<number | null>(null);
  const [aviso, setAviso] = useState(false);

  const alCompletar = useCallback((segundos: number | null) => {
    if (segundos == null) return;
    setAviso(false);
    // El cambio de identidad reinicia el temporizador aunque el descanso sea
    // el mismo número que el anterior.
    setDescanso(segundos);
  }, []);

  const series = ejercicios.flatMap((e) => e.series);
  const hechas = series.filter((s) => s.completada);
  const volumen = hechas.reduce(
    (n, s) => n + volumenDeSerie(s.peso, s.repeticiones),
    0,
  );

  return (
    <>
      <CabeceraSesion
        inicio={inicio}
        completado={completado}
        series={hechas.length}
        volumen={volumen}
      />

      {!completado && (
        <p className="mt-4 rounded-lg bg-superficie px-3 py-2 text-xs text-suave">
          Puedes cerrar esta pantalla y volver: la sesión se guarda sola y la
          retomas donde la dejaste.
        </p>
      )}

      {aviso && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-aviso px-3 py-2 text-sm text-aviso"
        >
          Descanso terminado.
        </p>
      )}

      <div className="mt-6 space-y-4 pb-40">
        {ejercicios.map((e) => (
          <EjercicioEnVivo
            key={e.id}
            entrenoId={entrenoId}
            entrenoEjercicioId={e.id}
            nombre={e.nombre}
            nota={e.nota}
            descansoSegundos={e.descanso_segundos}
            supersetGrupo={e.superset_grupo}
            series={e.series}
            anteriores={new Map(e.anteriores)}
            alCompletar={alCompletar}
          />
        ))}

        {ejercicios.length === 0 && (
          <p className="text-sm text-suave">
            Todavía no hay ejercicios. Añade el primero abajo.
          </p>
        )}

        {!completado && (
          <>
            <form action={anadirEjercicioSesion} className="space-y-2">
              <input type="hidden" name="entreno_id" value={entrenoId} />
              <label htmlFor="ejercicio_id" className="block text-sm font-medium">
                Añadir ejercicio
              </label>
              <select
                id="ejercicio_id"
                name="ejercicio_id"
                required
                className="h-12 w-full rounded-lg border border-borde bg-transparent px-3 text-sm"
              >
                {catalogo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_canonico}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="h-12 w-full rounded-lg border border-borde text-sm font-medium"
              >
                Añadir
              </button>
            </form>

            <form action={terminarSesion} className="pt-4">
              <input type="hidden" name="id" value={entrenoId} />
              <button
                type="submit"
                className="h-14 w-full rounded-lg bg-accion text-base font-medium text-sobre-accion"
              >
                Terminar entreno
              </button>
            </form>

            <form
              action={descartarSesion}
              onSubmit={(e) => {
                if (!confirm("¿Descartar la sesión? Se pierde lo registrado.")) {
                  e.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={entrenoId} />
              <button
                type="submit"
                className="h-12 w-full text-sm text-suave underline underline-offset-4 hover:text-error"
              >
                Descartar sesión
              </button>
            </form>
          </>
        )}
      </div>

      {descanso != null && (
        <Temporizador
          key={descanso}
          segundos={descanso}
          alTerminar={() => setAviso(true)}
          alCerrar={() => setDescanso(null)}
        />
      )}
    </>
  );
}

function CabeceraSesion({
  inicio,
  completado,
  series,
  volumen,
}: {
  inicio: string;
  completado: boolean;
  series: number;
  volumen: number;
}) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (completado) return;
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [completado]);

  const transcurrido = Math.max(0, ahora - new Date(inicio).getTime());
  const total = Math.floor(transcurrido / 1000);
  const hh = Math.floor(total / 3600);
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");

  return (
    <header className="flex items-baseline justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {completado ? "Entreno" : "Entreno en curso"}
        </h1>
        <p className="mt-0.5 text-xs text-suave tabular-nums">
          {!completado && (
            <>
              <span suppressHydrationWarning>
                {hh > 0 ? `${hh}:` : ""}
                {mm}:{ss}
              </span>
              {" · "}
            </>
          )}
          {series} {series === 1 ? "serie" : "series"} ·{" "}
          {Math.round(volumen).toLocaleString("es-ES")} kg de volumen
        </p>
      </div>
    </header>
  );
}
