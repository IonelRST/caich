import { notFound } from "next/navigation";
import { PanelSesion, type EjercicioSesion } from "./panel-sesion";
import type { Ejercicio, SerieAnterior, SerieRegistrada } from "@/lib/datos/entrenos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Entreno · caich" };

type FilaEjercicio = {
  id: string;
  orden: number;
  ejercicio_id: string;
  nota: string | null;
  descanso_segundos: number | null;
  superset_grupo: number | null;
  catalogo_ejercicio: { nombre_canonico: string } | null;
  registro_entreno_serie: SerieRegistrada[];
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

  const [{ data: filas }, { data: catalogo }] = await Promise.all([
    supabase
      .from("registro_entreno_ejercicio")
      .select(
        "id, orden, ejercicio_id, nota, descanso_segundos, superset_grupo, catalogo_ejercicio(nombre_canonico), registro_entreno_serie(id, numero_serie, tipo, peso, repeticiones, completada, peso_objetivo, reps_min, reps_max)",
      )
      .eq("entreno_id", id)
      .order("orden"),
    supabase
      .from("catalogo_ejercicio")
      .select("id, nombre_canonico, grupo_muscular, equipo")
      .order("nombre_canonico"),
  ]);

  const ejercicios = (filas ?? []) as unknown as FilaEjercicio[];

  const anteriores = await leerAnteriores(
    supabase,
    id,
    ejercicios.map((e) => e.ejercicio_id),
  );

  const datos: EjercicioSesion[] = ejercicios.map((e) => ({
    id: e.id,
    nombre: e.catalogo_ejercicio?.nombre_canonico ?? "Ejercicio",
    nota: e.nota,
    descanso_segundos: e.descanso_segundos,
    superset_grupo: e.superset_grupo,
    series: e.registro_entreno_serie
      .slice()
      .sort((a, b) => a.numero_serie - b.numero_serie),
    anteriores: [...(anteriores.get(e.ejercicio_id) ?? new Map())],
  }));

  return (
    // §21.2: esta pantalla va siempre en oscuro reforzado, sea cual sea el tema
    // del resto de la app. La clase redefine los tokens para todo el subárbol.
    // §22.3: sin navegación — la única salida es terminar o descartar.
    <main className="sesion-viva mx-auto min-h-dvh max-w-lg px-4 py-8">
      <PanelSesion
        entrenoId={id}
        inicio={entreno.fecha_evento}
        ejercicios={datos}
        catalogo={(catalogo as Ejercicio[]) ?? []}
        completado={entreno.completado}
      />
    </main>
  );
}

/**
 * Lo que se hizo la vez anterior, serie a serie (§5.2).
 *
 * La referencia va por índice: la serie 3 de hoy enseña la serie 3 del último
 * día que se hizo ese ejercicio. Si aquel día hubo menos series, no hay
 * referencia y la celda queda vacía — que es exactamente lo que pasó.
 *
 * Se toma el entreno más reciente completo, no la mejor marca histórica: la
 * pregunta que resuelve esta columna es "¿qué hice la última vez?", no "¿cuál
 * es mi récord?".
 */
async function leerAnteriores(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  entrenoActualId: string,
  idsEjercicio: string[],
): Promise<Map<string, Map<number, SerieAnterior>>> {
  const porEjercicio = new Map<string, Map<number, SerieAnterior>>();
  if (idsEjercicio.length === 0) return porEjercicio;

  const { data: previas } = await supabase
    .from("registro_entreno_ejercicio")
    .select(
      "ejercicio_id, registro_entreno!inner(fecha_evento, completado), registro_entreno_serie(numero_serie, peso, repeticiones, completada)",
    )
    .in("ejercicio_id", idsEjercicio)
    .neq("entreno_id", entrenoActualId)
    .eq("registro_entreno.completado", true)
    .limit(200);

  const ordenadas = (previas ?? []).slice().sort((a, b) => {
    const fa = (a.registro_entreno as unknown as { fecha_evento: string }).fecha_evento;
    const fb = (b.registro_entreno as unknown as { fecha_evento: string }).fecha_evento;
    return fb.localeCompare(fa);
  });

  for (const p of ordenadas) {
    if (porEjercicio.has(p.ejercicio_id)) continue;

    const series = ((p.registro_entreno_serie ?? []) as {
      numero_serie: number;
      peso: number | null;
      repeticiones: number | null;
      completada: boolean;
    }[]).filter((s) => s.completada);

    if (series.length === 0) continue;

    porEjercicio.set(
      p.ejercicio_id,
      new Map(
        series.map((s) => [
          s.numero_serie,
          { peso: s.peso, repeticiones: s.repeticiones },
        ]),
      ),
    );
  }

  return porEjercicio;
}
