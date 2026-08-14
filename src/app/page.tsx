import Link from "next/link";
import { FormularioMedida } from "./formulario-medida";
import { cerrarSesion } from "./login/acciones";
import { etiquetaDeMedida } from "@/lib/datos/medidas";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

export default async function Portada() {
  // El proxy ya redirige a /login si no hay sesión; aquí el usuario existe.
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();

  const { data: ultimas } = await supabase
    .from("registro_medida")
    .select("id, nombre, valor, unidad, fecha_evento")
    .order("fecha_evento", { ascending: false })
    .limit(5);

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

      <section className="mt-10">
        <h2 className="text-sm font-medium">Registrar una medida</h2>
        <div className="mt-4">
          <FormularioMedida />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium">Últimos registros</h2>
          <Link
            href="/historial"
            className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            Ver historial
          </Link>
        </div>

        {!ultimas || ultimas.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            Nada registrado todavía. Guarda tu primera medida arriba.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
            {ultimas.map((r) => (
              <li key={r.id} className="flex justify-between gap-4 py-2.5">
                <span className="text-sm">
                  {etiquetaDeMedida(r.nombre)}{" "}
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {r.valor} {r.unidad}
                  </span>
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatoFecha.format(new Date(r.fecha_evento))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
        <h2 className="text-sm font-medium">Siguiente</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Gráficos de evolución, y después el registro de entreno en vivo — que
          por diseño no usa la IA. El chat con parseo llegará cuando cargues
          créditos de la API de Claude. La dirección visual está pendiente
          (§21): esto todavía es andamiaje, no diseño.
        </p>
      </section>
    </main>
  );
}
