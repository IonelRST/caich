import Link from "next/link";
import { FormularioRutina } from "./formulario-rutina";
import { empezarSesion } from "@/lib/datos/entrenos-acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Rutinas · caich" };

export default async function Rutinas() {
  const supabase = await crearClienteServidor();

  const { data: rutinas } = await supabase
    .from("plantilla")
    .select("id, nombre, plantilla_item(count)")
    .eq("tipo", "rutina_entreno")
    .eq("activa", true)
    .order("creado_en", { ascending: false });

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Rutinas</h1>
        <Link
          href="/"
          className="text-sm text-suave underline underline-offset-4 hover:text-texto"
        >
          Volver
        </Link>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Nueva rutina</h2>
        <FormularioRutina />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Tus rutinas</h2>

        {!rutinas || rutinas.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            Todavía no tienes ninguna. Crea una arriba y añádele ejercicios.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-borde">
            {rutinas.map((r) => {
              const numEjercicios =
                (r.plantilla_item as unknown as { count: number }[])?.[0]
                  ?.count ?? 0;

              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/rutinas/${r.id}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {r.nombre}
                    </Link>
                    <p className="text-xs text-suave">
                      {numEjercicios}{" "}
                      {numEjercicios === 1 ? "ejercicio" : "ejercicios"}
                    </p>
                  </div>

                  {numEjercicios > 0 && (
                    <form action={empezarSesion}>
                      <input type="hidden" name="rutina_id" value={r.id} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg bg-accion px-3 py-1.5 text-sm font-medium text-sobre-accion"
                      >
                        Empezar
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
