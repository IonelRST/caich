import Link from "next/link";
import { etiquetaDeMedida, MEDIDAS_HABITUALES } from "@/lib/datos/medidas";
import { borrarMedida } from "@/lib/datos/medidas-acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Historial · caich" };

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function Historial({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; tipo?: string }>;
}) {
  const { desde, hasta, tipo } = await searchParams;
  const supabase = await crearClienteServidor();

  // RLS ya limita las filas al usuario de la sesión; no hace falta filtrar aquí.
  let consulta = supabase
    .from("registro_medida")
    .select("id, nombre, valor, unidad, fecha_evento, origen")
    .order("fecha_evento", { ascending: false })
    .limit(200);

  if (desde) consulta = consulta.gte("fecha_evento", `${desde}T00:00:00`);
  if (hasta) consulta = consulta.lte("fecha_evento", `${hasta}T23:59:59`);
  if (tipo) consulta = consulta.eq("nombre", tipo);

  const { data: registros, error } = await consulta;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <Link
          href="/"
          className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          Volver
        </Link>
      </header>

      {/* §8: filtrable por tipo de dato y rango de fechas. Como formulario GET,
          los filtros quedan en la URL y el enlace se puede compartir o guardar. */}
      <form method="get" className="mt-8 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="tipo" className="block text-xs font-medium">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipo ?? ""}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            <option value="">Todas</option>
            {MEDIDAS_HABITUALES.map((m) => (
              <option key={m.nombre} value={m.nombre}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="desde" className="block text-xs font-medium">
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desde ?? ""}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="hasta" className="block text-xs font-medium">
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hasta ?? ""}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
          />
        </div>

        <button
          type="submit"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Filtrar
        </button>

        {(desde || hasta || tipo) && (
          <Link
            href="/historial"
            className="py-1.5 text-sm text-neutral-500 underline underline-offset-4"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {error && (
        <p
          role="alert"
          className="mt-8 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          No se ha podido cargar el historial: {error.message}
        </p>
      )}

      {registros && registros.length === 0 && (
        <p className="mt-8 text-sm text-neutral-500 dark:text-neutral-400">
          {desde || hasta || tipo
            ? "No hay registros que encajen con esos filtros."
            : "Todavía no hay nada registrado. Añade tu primera medida desde la portada."}
        </p>
      )}

      {registros && registros.length > 0 && (
        <ul className="mt-8 divide-y divide-neutral-200 dark:divide-neutral-800">
          {registros.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {etiquetaDeMedida(r.nombre)}{" "}
                  <span className="font-normal text-neutral-500 dark:text-neutral-400">
                    {r.valor} {r.unidad}
                  </span>
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatoFecha.format(new Date(r.fecha_evento))}
                </p>
              </div>

              <form action={borrarMedida}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700 dark:text-neutral-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                >
                  Borrar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
