import { cerrarSesion } from "./login/acciones";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";

export default async function Portada() {
  // El middleware ya redirige a /login si no hay sesión; aquí el usuario existe.
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();

  // Consulta real: prueba de extremo a extremo de que sesión, RLS y datos van.
  const { count: numEjercicios } = await supabase
    .from("catalogo_ejercicio")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">caich</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {usuario?.email}
          </p>
        </div>

        <form action={cerrarSesion}>
          <button
            type="submit"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Salir
          </button>
        </form>
      </header>

      <section className="mt-10 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-medium">Estado de la instalación</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500 dark:text-neutral-400">Sesión</dt>
            <dd>Iniciada</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500 dark:text-neutral-400">
              Base de datos
            </dt>
            <dd>Conectada, con RLS activo</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500 dark:text-neutral-400">
              Catálogo de ejercicios
            </dt>
            <dd>{numEjercicios ?? 0} ejercicios</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
        <h2 className="text-sm font-medium">Siguiente</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Historial y gráficos, y después el registro de entreno en vivo — que
          por diseño no usa la IA. El chat con parseo llegará cuando cargues
          créditos de la API de Claude.
        </p>
      </section>
    </main>
  );
}
