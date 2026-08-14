import { GraficosEvolucion, type SerieMedida } from "./grafico";
import { etiquetaDeMedida } from "@/lib/datos/medidas";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Evolución · caich" };

const formatoEje = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

export default async function Evolucion() {
  const supabase = await crearClienteServidor();

  // Ascendente: el gráfico necesita los puntos en orden cronológico.
  const { data: registros } = await supabase
    .from("registro_medida")
    .select("nombre, valor, unidad, fecha_evento")
    .order("fecha_evento", { ascending: true });

  // Una serie por tipo de medida. Se agrupa en el servidor para no mandar al
  // navegador filas que luego habría que recorrer otra vez.
  const porNombre = new Map<string, SerieMedida>();

  for (const r of registros ?? []) {
    let serie = porNombre.get(r.nombre);
    if (!serie) {
      serie = {
        nombre: r.nombre,
        etiqueta: etiquetaDeMedida(r.nombre),
        unidad: r.unidad,
        puntos: [],
      };
      porNombre.set(r.nombre, serie);
    }
    serie.puntos.push({
      fecha: r.fecha_evento,
      etiqueta: formatoEje.format(new Date(r.fecha_evento)),
      valor: Number(r.valor),
    });
  }

  const series = [...porNombre.values()];

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Evolución</h1>
      </header>

      <GraficosEvolucion series={series} />
    </main>
  );
}
