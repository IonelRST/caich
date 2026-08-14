import Link from "next/link";
import { notFound } from "next/navigation";
import { EjercicioEnVivo } from "./ejercicio-en-vivo";
import { terminarSesion } from "@/lib/datos/entrenos-acciones";
import type { SerieAnterior } from "@/lib/datos/entrenos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Entreno · caich" };

type FilaEjercicio = {
  id: string;
  orden: number;
  ejercicio_id: string;
  catalogo_ejercicio: { nombre_canonico: string } | null;
  registro_entreno_serie: {
    id: string;
    numero_serie: number;
    peso: number | null;
    repeticiones: number | null;
  }[];
};

export default async function SesionEnVivo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: entreno } = await supabase
    .from("registro_entreno")
    .select("id, fecha_evento, completado, plantilla_id")
    .eq("id", id)
    .single();

  if (!entreno) notFound();

  const { data: filas } = await supabase
    .from("registro_entreno_ejercicio")
    .select(
      "id, orden, ejercicio_id, catalogo_ejercicio(nombre_canonico), registro_entreno_serie(id, numero_serie, peso, repeticiones)",
    )
    .eq("entreno_id", id)
    .order("orden");

  const ejercicios = (filas ?? []) as unknown as FilaEjercicio[];

  // Objetivos de la rutina de la que salió la sesión, si la hubo.
  const objetivos = new Map<
    string,
    { series: number | null; reps: number | null; peso: number | null }
  >();

  if (entreno.plantilla_id) {
    const { data: items } = await supabase
      .from("plantilla_item")
      .select("ejercicio_id, series_objetivo, reps_objetivo, peso_objetivo")
      .eq("plantilla_id", entreno.plantilla_id);

    for (const it of items ?? []) {
      objetivos.set(it.ejercicio_id, {
        series: it.series_objetivo,
        reps: it.reps_objetivo,
        peso: it.peso_objetivo,
      });
    }
  }

  // Referencia de la última vez (§5.2). Se traen las series recientes de esos
  // ejercicios en otros entrenos y se elige la más reciente de cada uno.
  const anteriores = new Map<string, SerieAnterior>();
  const idsEjercicio = ejercicios.map((e) => e.ejercicio_id);

  if (idsEjercicio.length > 0) {
    const { data: previas } = await supabase
      .from("registro_entreno_ejercicio")
      .select(
        "ejercicio_id, registro_entreno!inner(fecha_evento), registro_entreno_serie(peso, repeticiones, numero_serie)",
      )
      .in("ejercicio_id", idsEjercicio)
      .neq("entreno_id", id)
      .limit(100);

    const ordenadas = (previas ?? []).slice().sort((a, b) => {
      const fa = (a.registro_entreno as unknown as { fecha_evento: string })
        .fecha_evento;
      const fb = (b.registro_entreno as unknown as { fecha_evento: string })
        .fecha_evento;
      return fb.localeCompare(fa);
    });

    for (const p of ordenadas) {
      if (anteriores.has(p.ejercicio_id)) continue;
      const series = (p.registro_entreno_serie ?? []) as {
        peso: number | null;
        repeticiones: number | null;
        numero_serie: number;
      }[];
      if (series.length === 0) continue;
      // La serie más pesada de aquel día es la referencia más útil.
      const mejor = series.reduce((a, b) => ((b.peso ?? 0) > (a.peso ?? 0) ? b : a));
      anteriores.set(p.ejercicio_id, {
        peso: mejor.peso,
        repeticiones: mejor.repeticiones,
      });
    }
  }

  const totalSeries = ejercicios.reduce(
    (n, e) => n + e.registro_entreno_serie.length,
    0,
  );

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-8">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {entreno.completado ? "Entreno" : "Entreno en curso"}
          </h1>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {totalSeries} {totalSeries === 1 ? "serie" : "series"} registradas
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-neutral-500 underline underline-offset-4"
        >
          Salir
        </Link>
      </header>

      {!entreno.completado && (
        <p className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          Puedes cerrar esta pantalla y volver: la sesión se guarda sola y la
          retomas donde la dejaste.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {ejercicios.map((e) => {
          const obj = objetivos.get(e.ejercicio_id);
          return (
            <EjercicioEnVivo
              key={e.id}
              entrenoId={id}
              entrenoEjercicioId={e.id}
              nombre={e.catalogo_ejercicio?.nombre_canonico ?? "Ejercicio"}
              seriesObjetivo={obj?.series ?? null}
              repsObjetivo={obj?.reps ?? null}
              pesoObjetivo={obj?.peso ?? null}
              seriesHechas={e.registro_entreno_serie
                .slice()
                .sort((a, b) => a.numero_serie - b.numero_serie)}
              anterior={anteriores.get(e.ejercicio_id) ?? null}
            />
          );
        })}
      </div>

      {!entreno.completado && (
        <form action={terminarSesion} className="mt-8">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="h-12 w-full rounded-lg border border-neutral-300 text-sm font-medium dark:border-neutral-700"
          >
            Terminar entreno
          </button>
        </form>
      )}
    </main>
  );
}
