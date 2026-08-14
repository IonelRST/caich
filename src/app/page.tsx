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

  const [{ data: ultimas }, { data: enCurso }] = await Promise.all([
    supabase
      .from("registro_medida")
      .select("id, nombre, valor, unidad, fecha_evento")
      .order("fecha_evento", { ascending: false })
      .limit(5),
    // §5.3: una sesión sin terminar se puede retomar. Si no se mostrara aquí,
    // un entreno interrumpido quedaría enterrado y se daría por perdido.
    supabase
      .from("registro_entreno")
      .select("id, fecha_evento")
      .eq("completado", false)
      .order("fecha_evento", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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

      {enCurso && (
        <Link
          href={`/entreno/${enCurso.id}`}
          className="mt-8 flex items-center justify-between gap-4 rounded-xl bg-neutral-900 px-5 py-4 text-white dark:bg-white dark:text-neutral-900"
        >
          <span className="text-sm font-medium">Tienes un entreno en curso</span>
          <span className="text-sm">Retomar →</span>
        </Link>
      )}

      <nav className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/rutinas", texto: "Rutinas" },
          { href: "/objetivos", texto: "Objetivos" },
          { href: "/evolucion", texto: "Evolución" },
          { href: "/historial", texto: "Historial" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-neutral-200 px-4 py-3 text-center text-sm font-medium transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            {l.texto}
          </Link>
        ))}
      </nav>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Registrar una medida</h2>
        <div className="mt-4">
          <FormularioMedida />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Últimos registros</h2>

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

      <section className="mt-10 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="text-sm font-medium">Tus datos</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Son datos de salud personales. Puedes descargarlos cuando quieras, sin
          depender de que esta app siga existiendo.
        </p>
        <div className="mt-3 flex gap-4">
          <a
            href="/api/exportar?formato=json"
            className="text-sm underline underline-offset-4"
          >
            Descargar todo (JSON)
          </a>
          <a
            href="/api/exportar?formato=csv"
            className="text-sm underline underline-offset-4"
          >
            Medidas (CSV)
          </a>
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-dashed border-neutral-300 p-5 dark:border-neutral-700">
        <h2 className="text-sm font-medium">Pendiente</h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          El chat con parseo y los insights necesitan créditos de la API de
          Claude. La dirección visual está sin definir (§21): esto todavía es
          andamiaje, no diseño.
        </p>
      </section>
    </main>
  );
}
