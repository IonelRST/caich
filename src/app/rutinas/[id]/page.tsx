import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorEjercicio } from "./editor-ejercicio";
import { FormularioEjercicio } from "./formulario-ejercicio";
import { FormularioNombre } from "./formulario-nombre";
import { borrarRutina, empezarSesion } from "@/lib/datos/entrenos-acciones";
import type { Ejercicio, ItemRutina, SerieRutina } from "@/lib/datos/entrenos";
import { crearClienteServidor } from "@/lib/supabase/server";

type FilaItem = {
  id: string;
  orden: number;
  nota: string | null;
  descanso_segundos: number | null;
  superset_grupo: number | null;
  catalogo_ejercicio: Ejercicio | null;
  plantilla_serie: SerieRutina[];
};

export default async function DetalleRutina({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: rutina } = await supabase
    .from("plantilla")
    .select("id, nombre")
    .eq("id", id)
    .eq("tipo", "rutina_entreno")
    .single();

  // RLS ya impide ver rutinas ajenas: si no aparece, para este usuario no existe.
  if (!rutina) notFound();

  const [{ data: filas }, { data: ejercicios }] = await Promise.all([
    supabase
      .from("plantilla_item")
      .select(
        "id, orden, nota, descanso_segundos, superset_grupo, catalogo_ejercicio(id, nombre_canonico, grupo_muscular, equipo), plantilla_serie(id, numero_serie, tipo, peso_objetivo, reps_min, reps_max)",
      )
      .eq("plantilla_id", id)
      .order("orden"),
    supabase
      .from("catalogo_ejercicio")
      .select("id, nombre_canonico, grupo_muscular, equipo")
      .order("nombre_canonico"),
  ]);

  const items: ItemRutina[] = ((filas ?? []) as unknown as FilaItem[])
    .filter((f) => f.catalogo_ejercicio != null)
    .map((f) => ({
      id: f.id,
      orden: f.orden,
      ejercicio_id: f.catalogo_ejercicio!.id,
      nota: f.nota,
      descanso_segundos: f.descanso_segundos,
      superset_grupo: f.superset_grupo,
      series: (f.plantilla_serie ?? [])
        .slice()
        .sort((a, b) => a.numero_serie - b.numero_serie),
      ejercicio: f.catalogo_ejercicio!,
    }));

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{rutina.nombre}</h1>
        <Link
          href="/rutinas"
          className="shrink-0 text-sm text-suave underline underline-offset-4 hover:text-texto"
        >
          Volver
        </Link>
      </header>

      <FormularioNombre id={id} nombre={rutina.nombre} />

      <section className="mt-8">
        <h2 className="text-sm font-medium">Ejercicios</h2>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            Todavía no hay ninguno. Añade el primero abajo.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {items.map((it, i) => (
              <EditorEjercicio
                key={it.id}
                item={it}
                rutinaId={id}
                puedeSubir={i > 0}
                // El primero no tiene ejercicio de arriba con el que emparejarse.
                puedeAgrupar={i > 0}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Añadir ejercicio</h2>
        <FormularioEjercicio
          rutinaId={id}
          ejercicios={(ejercicios as Ejercicio[]) ?? []}
        />
      </section>

      {items.length > 0 && (
        <section className="mt-10">
          <form action={empezarSesion}>
            <input type="hidden" name="rutina_id" value={id} />
            <button
              type="submit"
              className="h-14 w-full rounded-lg bg-accion text-base font-medium text-sobre-accion"
            >
              Empezar entreno
            </button>
          </form>
        </section>
      )}

      <section className="mt-10 border-t border-borde pt-6">
        <form action={borrarRutina}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            className="text-sm text-suave underline underline-offset-4 hover:text-error"
          >
            Borrar esta rutina
          </button>
        </form>
      </section>
    </main>
  );
}
