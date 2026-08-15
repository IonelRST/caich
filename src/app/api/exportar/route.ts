import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Exportación completa del histórico (§13).
 *
 * Existe por dos motivos, ambos en la especificación: son datos de salud
 * personales, y no conviene depender al 100% de la infraestructura propia.
 *
 * RLS limita todas las consultas al usuario de la sesión, así que no hay forma
 * de exportar datos ajenos ni aun manipulando la petición.
 */
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formato = request.nextUrl.searchParams.get("formato") ?? "json";

  const [medidas, entrenos, comidas, rutinas, objetivos] = await Promise.all([
    supabase
      .from("registro_medida")
      .select("nombre, valor, unidad, fecha_evento, fecha_registro, origen")
      .order("fecha_evento"),
    supabase
      .from("registro_entreno")
      .select(
        "id, fecha_evento, fecha_registro, origen, completado, notas, registro_entreno_ejercicio(orden, catalogo_ejercicio(nombre_canonico), registro_entreno_serie(numero_serie, peso, repeticiones))",
      )
      .order("fecha_evento"),
    supabase
      .from("registro_comida")
      .select(
        "fecha_evento, momento_dia, descripcion, cantidad, calorias, proteina_g, carbohidratos_g, grasas_g, origen_dato, adherencia",
      )
      .order("fecha_evento"),
    supabase
      .from("plantilla")
      .select(
        "nombre, tipo, plantilla_item(orden, nota, descanso_segundos, superset_grupo, descripcion, cantidad, catalogo_ejercicio(nombre_canonico), plantilla_serie(numero_serie, tipo, peso_objetivo, reps_min, reps_max))",
      ),
    supabase
      .from("objetivo")
      .select(
        "descripcion, metrica, valor_objetivo, unidad, direccion, fecha_objetivo, cumplido_en",
      ),
  ]);

  const fecha = new Date().toISOString().slice(0, 10);

  if (formato === "csv") {
    // Un CSV no representa bien datos anidados, así que se exportan las medidas
    // (que sí son tabulares) y para el resto se remite al JSON, que no pierde
    // nada. Mejor eso que un CSV con series de entreno aplastadas en una celda.
    const filas = [
      ["fecha", "medida", "valor", "unidad", "origen"],
      ...(medidas.data ?? []).map((m) => [
        m.fecha_evento,
        m.nombre,
        String(m.valor),
        m.unidad,
        m.origen,
      ]),
    ];

    const csv = filas
      .map((f) =>
        f
          .map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
          .join(","),
      )
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="caich-medidas-${fecha}.csv"`,
      },
    });
  }

  const datos = {
    exportado_en: new Date().toISOString(),
    usuario: user.email,
    medidas: medidas.data ?? [],
    entrenos: entrenos.data ?? [],
    comidas: comidas.data ?? [],
    plantillas: rutinas.data ?? [],
    objetivos: objetivos.data ?? [],
  };

  return new NextResponse(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="caich-${fecha}.json"`,
    },
  });
}
