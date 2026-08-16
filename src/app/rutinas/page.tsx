import Link from "next/link";
import { FormularioRutina } from "./formulario-rutina";
import { empezarSesion, empezarSesionVacia } from "@/lib/datos/entrenos-acciones";
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Rutinas</h1>
      </header>

      {/* §5.2: entreno vacío — se arranca sin plan y se añaden ejercicios
          sobre la marcha. */}
      <section className="mt-8">
        <form action={empezarSesionVacia}>
          <button
            type="submit"
            className="control h-14 w-full rounded-xl text-base font-medium"
          >
            Empezar entreno vacío
          </button>
        </form>
      </section>

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
                    <p className="text-sm font-medium">{r.nombre}</p>
                    <p className="text-xs text-suave">
                      {numEjercicios}{" "}
                      {numEjercicios === 1 ? "ejercicio" : "ejercicios"}
                    </p>
                  </div>

                  {/*
                    Editar tiene control propio y visible. Antes el único acceso
                    era el nombre como enlace, subrayado solo al pasar por
                    encima: en un móvil no hay "por encima", así que renombrar,
                    reordenar y borrar —que existen desde siempre— parecían no
                    existir. Se muestra también con cero ejercicios, que es
                    justo cuando hace falta entrar.
                  */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/rutinas/${r.id}`}
                      className="control rounded-lg px-3 py-1.5 text-sm font-medium"
                    >
                      Editar
                    </Link>

                    {numEjercicios > 0 && (
                      <form action={empezarSesion}>
                        <input type="hidden" name="rutina_id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-accion px-3 py-1.5 text-sm font-medium text-sobre-accion shadow-apoyado"
                        >
                          Empezar
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
