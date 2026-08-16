import {
  EditorObjetivo,
  FormularioObjetivo,
  type OpcionMetrica,
} from "./formulario-objetivo";
import { etiquetaDeMedida } from "@/lib/datos/medidas";
import {
  borrarObjetivo,
  marcarCumplido,
} from "@/lib/datos/objetivos-acciones";
import {
  calcularProgreso,
  claveDeMetrica,
  familiaDeMetrica,
  type Objetivo,
} from "@/lib/datos/objetivos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Objetivos · caich" };

export default async function Objetivos() {
  const supabase = await crearClienteServidor();

  const [{ data: objetivos }, { data: medidas }, { data: series }] =
    await Promise.all([
      supabase
        .from("objetivo")
        .select(
          "id, descripcion, metrica, valor_objetivo, unidad, direccion, fecha_objetivo, cumplido_en",
        )
        .order("creado_en", { ascending: false }),
      supabase
        .from("registro_medida")
        .select("nombre, valor, unidad, fecha_evento")
        .order("fecha_evento", { ascending: true }),
      supabase
        .from("registro_entreno_serie")
        .select(
          "peso, registro_entreno_ejercicio!inner(ejercicio_id, catalogo_ejercicio(nombre_canonico))",
        )
        // Una serie planificada y no marcada no es una marca conseguida (§5.2).
        .eq("completada", true),
    ]);

  // Valor actual e inicial de cada medida, para calcular el progreso.
  const actualMedida = new Map<string, number>();
  const inicialMedida = new Map<string, number>();
  const unidadMedida = new Map<string, string>();

  for (const m of medidas ?? []) {
    if (!inicialMedida.has(m.nombre)) inicialMedida.set(m.nombre, Number(m.valor));
    actualMedida.set(m.nombre, Number(m.valor));
    unidadMedida.set(m.nombre, m.unidad);
  }

  // PR por ejercicio: el peso máximo levantado.
  const prEjercicio = new Map<string, number>();
  const nombreEjercicio = new Map<string, string>();

  for (const s of series ?? []) {
    const rel = s.registro_entreno_ejercicio as unknown as {
      ejercicio_id: string;
      catalogo_ejercicio: { nombre_canonico: string } | null;
    };
    if (!rel) continue;
    const peso = Number(s.peso ?? 0);
    if (peso > (prEjercicio.get(rel.ejercicio_id) ?? 0)) {
      prEjercicio.set(rel.ejercicio_id, peso);
    }
    if (rel.catalogo_ejercicio) {
      nombreEjercicio.set(rel.ejercicio_id, rel.catalogo_ejercicio.nombre_canonico);
    }
  }

  const opciones: OpcionMetrica[] = [
    ...[...actualMedida.keys()].map((nombre) => ({
      metrica: `measurement:${nombre}`,
      etiqueta: etiquetaDeMedida(nombre),
      unidad: unidadMedida.get(nombre) ?? "",
    })),
    ...[...prEjercicio.keys()].map((id) => ({
      metrica: `exercise_pr:${id}`,
      etiqueta: `PR de ${nombreEjercicio.get(id) ?? "ejercicio"}`,
      unidad: "kg",
    })),
  ];

  function valorDe(metrica: string): number | null {
    const clave = claveDeMetrica(metrica);
    if (familiaDeMetrica(metrica) === "measurement") {
      return actualMedida.get(clave) ?? null;
    }
    if (familiaDeMetrica(metrica) === "exercise_pr") {
      return prEjercicio.get(clave) ?? null;
    }
    return null;
  }

  function inicialDe(metrica: string): number | null {
    if (familiaDeMetrica(metrica) !== "measurement") return null;
    return inicialMedida.get(claveDeMetrica(metrica)) ?? null;
  }

  const activos = (objetivos ?? []).filter((o) => !o.cumplido_en);
  const cumplidos = (objetivos ?? []).filter((o) => o.cumplido_en);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Objetivos</h1>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium">En curso</h2>

        {activos.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            No tienes objetivos activos.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {activos.map((o) => {
              const p = calcularProgreso(
                o as Objetivo,
                valorDe(o.metrica),
                inicialDe(o.metrica),
              );

              return (
                <li
                  key={o.id}
                  className="alzado rounded-xl p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium">{o.descripcion}</p>
                    <span className="shrink-0 text-xs text-suave">
                      {p.valorActual == null
                        ? "sin datos"
                        : `${p.valorActual} → ${o.valor_objetivo} ${o.unidad}`}
                    </span>
                  </div>

                  {p.porcentaje != null && (
                    <div className="mt-3">
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-borde"
                        role="progressbar"
                        aria-valuenow={p.porcentaje}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progreso de ${o.descripcion}`}
                      >
                        <div
                          className="h-full rounded-full bg-accion"
                          style={{ width: `${p.porcentaje}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-suave">
                        {p.alcanzado
                          ? "Objetivo alcanzado."
                          : `${p.porcentaje} % del recorrido`}
                        {o.fecha_objetivo &&
                          ` · fecha límite ${new Date(o.fecha_objetivo).toLocaleDateString("es-ES")}`}
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    {p.alcanzado && (
                      <form action={marcarCumplido}>
                        <input type="hidden" name="id" value={o.id} />
                        <button
                          type="submit"
                          className="text-xs font-medium underline underline-offset-4"
                        >
                          Marcar como cumplido
                        </button>
                      </form>
                    )}
                    {/* §19 punto 22: corregir la meta, la fecha o el enunciado
                        sin tener que borrar el objetivo y perder su histórico. */}
                    <EditorObjetivo
                      objetivo={{
                        id: o.id,
                        descripcion: o.descripcion,
                        metrica: o.metrica,
                        valor_objetivo: Number(o.valor_objetivo),
                        unidad: o.unidad,
                        direccion: o.direccion,
                        fecha_objetivo: o.fecha_objetivo,
                      }}
                      opciones={opciones}
                    />
                    <form action={borrarObjetivo}>
                      <input type="hidden" name="id" value={o.id} />
                      <button
                        type="submit"
                        className="text-xs text-suave underline underline-offset-4 hover:text-error"
                      >
                        Borrar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Nuevo objetivo</h2>
        <FormularioObjetivo opciones={opciones} />
      </section>

      {cumplidos.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium">Cumplidos</h2>
          <ul className="mt-4 divide-y divide-borde">
            {cumplidos.map((o) => (
              <li key={o.id} className="flex justify-between gap-4 py-2.5">
                <span className="text-sm">{o.descripcion}</span>
                <span className="text-xs text-suave">
                  {new Date(o.cumplido_en!).toLocaleDateString("es-ES")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
