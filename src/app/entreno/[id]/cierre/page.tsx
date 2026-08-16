import { notFound } from "next/navigation";
import { FormularioCierre } from "./formulario-cierre";
import { sesionSeDesvio, volumenDeSerie } from "@/lib/datos/entrenos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Cerrar entreno · caich" };

type FilaEjercicio = {
  ejercicio_id: string;
  orden: number;
  catalogo_ejercicio: { nombre_canonico: string } | null;
  registro_entreno_serie: {
    peso: number | null;
    repeticiones: number | null;
    completada: boolean;
  }[];
};

export default async function CierreDeSesion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: entreno } = await supabase
    .from("registro_entreno")
    .select("id, fecha_evento, completado, plantilla_id, notas")
    .eq("id", id)
    .single();

  if (!entreno) notFound();

  const { data: filas } = await supabase
    .from("registro_entreno_ejercicio")
    .select(
      "ejercicio_id, orden, catalogo_ejercicio(nombre_canonico), registro_entreno_serie(peso, repeticiones, completada)",
    )
    .eq("entreno_id", id)
    .order("orden");

  const ejercicios = (filas ?? []) as unknown as FilaEjercicio[];

  const hechas = ejercicios.flatMap((e) =>
    e.registro_entreno_serie.filter((s) => s.completada),
  );
  const volumen = hechas.reduce(
    (n, s) => n + volumenDeSerie(s.peso, s.repeticiones),
    0,
  );
  const sinMarcar = ejercicios.reduce(
    (n, e) => n + e.registro_entreno_serie.filter((s) => !s.completada).length,
    0,
  );

  // ¿Se desvió de la rutina? Es lo único que decide si se ofrece actualizar la
  // plantilla (§5.3). Sin rutina de origen no hay nada que actualizar.
  let desviada = false;

  if (entreno.plantilla_id) {
    const { data: items } = await supabase
      .from("plantilla_item")
      .select("ejercicio_id, orden, plantilla_serie(id)")
      .eq("plantilla_id", entreno.plantilla_id)
      .order("orden");

    const plan = (items ?? []).map((it) => ({
      ejercicioId: it.ejercicio_id as string,
      series: ((it.plantilla_serie ?? []) as unknown[]).length,
    }));

    const hecho = ejercicios.map((e) => ({
      ejercicioId: e.ejercicio_id,
      series: e.registro_entreno_serie.filter((s) => s.completada).length,
    }));

    desviada = sesionSeDesvio(plan, hecho);
  }

  const resumen = ejercicios
    .map((e) => {
      const n = e.registro_entreno_serie.filter((s) => s.completada).length;
      return { nombre: e.catalogo_ejercicio?.nombre_canonico ?? "Ejercicio", series: n };
    })
    .filter((e) => e.series > 0);

  return (
    // El cierre ya no es la sesión: se hace parado, así que sigue el tema
    // general de la app y no el oscuro reforzado de la §21.2.
    <main className="mx-auto min-h-dvh max-w-lg px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Cerrar entreno</h1>

      {/* §21.9 y §5.3: resumen sobrio. Lo que hubo, sin celebrarlo. */}
      <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Dato etiqueta="Series" valor={String(hechas.length)} />
        <Dato
          etiqueta="Volumen"
          valor={`${Math.round(volumen).toLocaleString("es-ES")} kg`}
        />
        <Dato etiqueta="Ejercicios" valor={String(resumen.length)} />
      </dl>

      {resumen.length > 0 && (
        <ul className="mt-6 divide-y divide-borde text-sm">
          {resumen.map((e) => (
            <li key={e.nombre} className="flex justify-between gap-4 py-2">
              <span>{e.nombre}</span>
              <span className="text-suave tabular-nums">
                {e.series} {e.series === 1 ? "serie" : "series"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sinMarcar > 0 && (
        <p className="mt-6 rounded-lg border border-aviso px-3 py-2 text-sm text-aviso">
          {sinMarcar === 1
            ? "Queda 1 serie sin marcar y no se guardará."
            : `Quedan ${sinMarcar} series sin marcar y no se guardarán.`}
        </p>
      )}

      <FormularioCierre
        id={id}
        fechaEvento={entreno.fecha_evento}
        notas={entreno.notas}
        desviada={desviada}
      />
    </main>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="alzado rounded-lg p-3">
      <dt className="text-xs text-suave">{etiqueta}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}
