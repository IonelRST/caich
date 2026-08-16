import Link from "next/link";
import { borrarComidaRegistrada } from "@/lib/datos/dieta-acciones";
import { borrarEntreno } from "@/lib/datos/entrenos-acciones";
import { etiquetaDeMedida, MEDIDAS_HABITUALES } from "@/lib/datos/medidas";
import { borrarMedida } from "@/lib/datos/medidas-acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Historial · caich" };

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Entrada unificada del historial (§8): "vista de lista con todos los
 * registros guardados", no solo los de un tipo.
 */
type Entrada = {
  id: string;
  tipo: "medida" | "entreno" | "comida";
  fecha: string;
  titulo: string;
  detalle: string;
};

const BORRADO: Record<Entrada["tipo"], (formData: FormData) => Promise<void>> = {
  medida: borrarMedida,
  entreno: borrarEntreno,
  comida: borrarComidaRegistrada,
};

export default async function Historial({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; tipo?: string }>;
}) {
  const { desde, hasta, tipo } = await searchParams;
  const supabase = await crearClienteServidor();

  const filtraTipo = (t: Entrada["tipo"]) =>
    !tipo || tipo === t || (tipo.startsWith("medida:") && t === "medida");

  // RLS ya limita las filas al usuario de la sesión.
  const [medidas, entrenos, comidas] = await Promise.all([
    filtraTipo("medida")
      ? (async () => {
          let q = supabase
            .from("registro_medida")
            .select("id, nombre, valor, unidad, fecha_evento")
            .order("fecha_evento", { ascending: false })
            .limit(200);
          if (desde) q = q.gte("fecha_evento", `${desde}T00:00:00`);
          if (hasta) q = q.lte("fecha_evento", `${hasta}T23:59:59`);
          if (tipo?.startsWith("medida:")) {
            q = q.eq("nombre", tipo.slice("medida:".length));
          }
          return q;
        })()
      : { data: [] },
    filtraTipo("entreno")
      ? (async () => {
          let q = supabase
            .from("registro_entreno")
            .select(
              "id, fecha_evento, completado, registro_entreno_ejercicio(catalogo_ejercicio(nombre_canonico), registro_entreno_serie(peso, repeticiones, completada))",
            )
            .order("fecha_evento", { ascending: false })
            .limit(100);
          if (desde) q = q.gte("fecha_evento", `${desde}T00:00:00`);
          if (hasta) q = q.lte("fecha_evento", `${hasta}T23:59:59`);
          return q;
        })()
      : { data: [] },
    filtraTipo("comida")
      ? (async () => {
          let q = supabase
            .from("registro_comida")
            .select("id, fecha_evento, descripcion, momento_dia, adherencia")
            .order("fecha_evento", { ascending: false })
            .limit(100);
          if (desde) q = q.gte("fecha_evento", `${desde}T00:00:00`);
          if (hasta) q = q.lte("fecha_evento", `${hasta}T23:59:59`);
          return q;
        })()
      : { data: [] },
  ]);

  const entradas: Entrada[] = [
    ...(medidas.data ?? []).map((m) => ({
      id: m.id,
      tipo: "medida" as const,
      fecha: m.fecha_evento,
      titulo: etiquetaDeMedida(m.nombre),
      detalle: `${m.valor} ${m.unidad}`,
    })),
    ...(entrenos.data ?? []).map((e) => {
      const ejercicios = (e.registro_entreno_ejercicio ?? []) as unknown as {
        catalogo_ejercicio: { nombre_canonico: string } | null;
        registro_entreno_serie: {
          peso: number | null;
          repeticiones: number | null;
          completada: boolean;
        }[];
      }[];
      // Solo cuentan las series marcadas: en una sesión en curso las filas
      // existen desde que arranca, hechas o no (§5.2).
      const numSeries = ejercicios.reduce(
        (n, ej) =>
          n + (ej.registro_entreno_serie ?? []).filter((s) => s.completada).length,
        0,
      );
      const nombres = ejercicios
        .map((ej) => ej.catalogo_ejercicio?.nombre_canonico)
        .filter(Boolean)
        .join(", ");
      return {
        id: e.id,
        tipo: "entreno" as const,
        fecha: e.fecha_evento,
        titulo: e.completado ? "Entreno" : "Entreno sin terminar",
        detalle: `${numSeries} ${numSeries === 1 ? "serie" : "series"}${nombres ? ` · ${nombres}` : ""}`,
      };
    }),
    ...(comidas.data ?? []).map((c) => ({
      id: c.id,
      tipo: "comida" as const,
      fecha: c.fecha_evento,
      titulo: c.momento_dia ?? "Comida",
      detalle: c.descripcion ?? "",
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const hayFiltros = Boolean(desde || hasta || tipo);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
      </header>

      {/* §8: filtrable por tipo de dato y rango de fechas. Como formulario GET,
          los filtros quedan en la URL y el enlace se puede guardar. */}
      <form method="get" className="mt-8 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="tipo" className="block text-xs font-medium">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipo ?? ""}
            className="hundido rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">Todo</option>
            <option value="entreno">Entrenos</option>
            <option value="comida">Comidas</option>
            <option value="medida">Todas las medidas</option>
            {MEDIDAS_HABITUALES.map((m) => (
              <option key={m.nombre} value={`medida:${m.nombre}`}>
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
            className="hundido rounded-lg px-3 py-1.5 text-sm"
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
            className="hundido rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        <button
          type="submit"
          className="control rounded-lg px-3 py-1.5 text-sm"
        >
          Filtrar
        </button>

        {hayFiltros && (
          <Link
            href="/historial"
            className="py-1.5 text-sm text-suave underline underline-offset-4"
          >
            Quitar filtros
          </Link>
        )}
      </form>

      {entradas.length === 0 ? (
        <p className="mt-8 text-sm text-suave">
          {hayFiltros
            ? "No hay registros que encajen con esos filtros."
            : "Todavía no hay nada registrado."}
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-borde">
          {entradas.map((e) => (
            <li
              key={`${e.tipo}-${e.id}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {e.titulo}{" "}
                  <span className="font-normal text-suave">
                    {e.detalle}
                  </span>
                </p>
                <p className="text-xs text-suave">
                  {formatoFecha.format(new Date(e.fecha))}
                </p>
              </div>

              {/* §8: todo lo del historial se puede borrar, sin excepciones por
                  tipo. Con el registro de un toque de la §6.2, no poder deshacer
                  una comida dejaba un dato falso permanente. */}
              <form action={BORRADO[e.tipo]}>
                <input type="hidden" name="id" value={e.id} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-suave hover:bg-error/10 hover:text-error"
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
