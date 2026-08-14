import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioEjercicio } from "./formulario-ejercicio";
import {
  borrarRutina,
  empezarSesion,
  quitarEjercicio,
} from "@/lib/datos/entrenos-acciones";
import type { Ejercicio } from "@/lib/datos/entrenos";
import { crearClienteServidor } from "@/lib/supabase/server";

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

  const [{ data: items }, { data: ejercicios }] = await Promise.all([
    supabase
      .from("plantilla_item")
      .select(
        "id, orden, series_objetivo, reps_objetivo, peso_objetivo, catalogo_ejercicio(id, nombre_canonico, grupo_muscular, equipo)",
      )
      .eq("plantilla_id", id)
      .order("orden"),
    supabase
      .from("catalogo_ejercicio")
      .select("id, nombre_canonico, grupo_muscular, equipo")
      .order("nombre_canonico"),
  ]);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {rutina.nombre}
        </h1>
        <Link
          href="/rutinas"
          className="text-sm text-suave underline underline-offset-4 hover:text-texto"
        >
          Volver
        </Link>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Ejercicios</h2>

        {!items || items.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            Todavía no hay ninguno. Añade el primero abajo.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-borde">
            {items.map((it) => {
              const ej = it.catalogo_ejercicio as unknown as Ejercicio | null;
              return (
                <li
                  key={it.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {ej?.nombre_canonico ?? "Ejercicio"}
                    </p>
                    <p className="text-xs text-suave">
                      {it.series_objetivo}×{it.reps_objetivo}
                      {it.peso_objetivo != null && ` · ${it.peso_objetivo} kg`}
                    </p>
                  </div>

                  <form action={quitarEjercicio}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="rutina_id" value={id} />
                    <button
                      type="submit"
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-suave hover:bg-error/10 hover:text-error"
                    >
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Añadir ejercicio</h2>
        <FormularioEjercicio
          rutinaId={id}
          ejercicios={(ejercicios as Ejercicio[]) ?? []}
        />
      </section>

      {items && items.length > 0 && (
        <section className="mt-10">
          <form action={empezarSesion}>
            <input type="hidden" name="rutina_id" value={id} />
            <button
              type="submit"
              className="w-full rounded-lg bg-accion px-4 py-3 text-sm font-medium text-sobre-accion"
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
