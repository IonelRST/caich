"use server";

import { revalidatePath } from "next/cache";
import { parsearMensaje } from "@/lib/ia/parseo";
import type { Parseo } from "@/lib/ia/esquemas";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoChat = {
  error?: string;
  /** Lo que se ha guardado, en lenguaje llano. */
  guardado?: string[];
  /** Lo que la IA no ha entendido y hay que aclarar (§7.4). */
  dudas?: string[];
  /** Ejercicios que no están en el catálogo y requieren confirmación (§4.1). */
  ejerciciosDesconocidos?: string[];
  /** El texto enviado, para poder reintentar sin reescribirlo. */
  texto?: string;
};

type EjercicioCatalogo = {
  id: string;
  nombre_canonico: string;
  alias: string[];
};

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Resuelve el nombre que escribió el usuario contra el catálogo (§4.1).
 *
 * Se compara por nombre canónico y por alias, sin acentos ni mayúsculas, para
 * que "sentadilla", "Sentadillas" y "squat" caigan en la misma fila. Sin esto
 * los gráficos por ejercicio y los PRs serían basura: el mismo movimiento
 * aparecería como tres ejercicios distintos según cómo se escribiera ese día.
 */
function resolverEjercicio(
  nombre: string,
  catalogo: EjercicioCatalogo[],
): EjercicioCatalogo | undefined {
  const buscado = normalizar(nombre);

  const exacto =
    catalogo.find((e) => normalizar(e.nombre_canonico) === buscado) ??
    catalogo.find((e) => e.alias.some((a) => normalizar(a) === buscado));

  if (exacto) return exacto;

  // Último recurso para formas ligeramente distintas, y solo si no hay ambigüedad.
  // El catálogo tiene "Press de banca", "Press inclinado" y "Press militar": si
  // "press" se resolviera al primero que coincide, el PR de un ejercicio quedaría
  // contaminado con series de otro, en silencio. Ante varios candidatos es mejor
  // preguntar, que es justamente lo que exige §4.1.
  const parciales = catalogo.filter((e) => {
    const canonico = normalizar(e.nombre_canonico);
    return buscado.startsWith(canonico) || canonico.startsWith(buscado);
  });

  return parciales.length === 1 ? parciales[0] : undefined;
}

/**
 * Fecha del parseo (día) convertida a timestamp.
 *
 * Se fija a mediodía por el mismo motivo que en el formulario de medidas: así un
 * cambio de huso horario no desplaza el registro al día anterior.
 */
function aTimestamp(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toISOString();
}

export async function registrarPorChat(
  _previo: EstadoChat,
  formData: FormData,
): Promise<EstadoChat> {
  const texto = formData.get("texto");
  if (typeof texto !== "string" || texto.trim().length === 0) {
    return { error: "Escribe algo para registrar." };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { data: catalogo } = await supabase
    .from("catalogo_ejercicio")
    .select("id, nombre_canonico, alias");

  const ejercicios: EjercicioCatalogo[] = catalogo ?? [];

  // La fecha se calcula en el servidor y se le pasa a la IA: el modelo no tiene
  // reloj, y sin esto "ayer" no se puede resolver (§3.2).
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60_000;
  const hoyISO = new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);

  let parseo: Parseo;
  try {
    parseo = await parsearMensaje(
      texto,
      ejercicios.map((e) => e.nombre_canonico),
      hoyISO,
    );
  } catch (fallo) {
    return {
      texto,
      error:
        fallo instanceof Error
          ? `No se ha podido interpretar el mensaje: ${fallo.message}`
          : "No se ha podido interpretar el mensaje.",
    };
  }

  // El texto original se conserva siempre, antes de guardar nada estructurado
  // (§7.1): si el parseo resultara equivocado, se puede reprocesar o auditar.
  const { data: mensaje, error: errorMensaje } = await supabase
    .from("mensaje_original")
    .insert({ user_id: user.id, texto })
    .select("id")
    .single();

  if (errorMensaje || !mensaje) {
    return { texto, error: "No se ha podido guardar el mensaje." };
  }

  const guardado: string[] = [];
  const dudas = [...parseo.dudas];
  const desconocidos = new Set<string>();

  if (parseo.medidas.length > 0) {
    const { error } = await supabase.from("registro_medida").insert(
      parseo.medidas.map((m) => ({
        user_id: user.id,
        fecha_evento: aTimestamp(m.fecha),
        origen: "chat",
        mensaje_id: mensaje.id,
        nombre: m.nombre,
        valor: m.valor,
        unidad: m.unidad,
      })),
    );

    if (error) {
      dudas.push(`No se han podido guardar las medidas: ${error.message}`);
    } else {
      for (const m of parseo.medidas) {
        guardado.push(`${m.nombre.replace(/_/g, " ")}: ${m.valor} ${m.unidad}`);
      }
    }
  }

  if (parseo.comidas.length > 0) {
    const { error } = await supabase.from("registro_comida").insert(
      parseo.comidas.map((c) => ({
        user_id: user.id,
        fecha_evento: aTimestamp(c.fecha),
        origen: "chat",
        mensaje_id: mensaje.id,
        momento_dia: c.momento_dia,
        descripcion: c.descripcion,
        cantidad: c.cantidad,
        calorias: c.calorias,
        proteina_g: c.proteina_g,
        carbohidratos_g: c.carbohidratos_g,
        grasas_g: c.grasas_g,
        origen_dato: c.origen_dato,
      })),
    );

    if (error) {
      dudas.push(`No se han podido guardar las comidas: ${error.message}`);
    } else {
      for (const c of parseo.comidas) {
        const kcal = c.calorias === null ? "" : ` (${c.calorias} kcal)`;
        guardado.push(`${c.descripcion}${kcal}`);
      }
    }
  }

  for (const entreno of parseo.entrenos) {
    // Se separan los ejercicios reconocidos de los que no. Los desconocidos no
    // se crean solos: §4.1 exige confirmar antes, por si en realidad son un
    // alias de uno que ya existe.
    const reconocidos = entreno.ejercicios.flatMap((ej) => {
      const fila = resolverEjercicio(ej.nombre, ejercicios);
      if (!fila) {
        desconocidos.add(ej.nombre);
        return [];
      }
      return [{ fila, series: ej.series }];
    });

    if (reconocidos.length === 0) continue;

    const { data: cabecera, error: errorCabecera } = await supabase
      .from("registro_entreno")
      .insert({
        user_id: user.id,
        fecha_evento: aTimestamp(entreno.fecha),
        origen: "chat",
        mensaje_id: mensaje.id,
        notas: entreno.notas,
        completado: true,
      })
      .select("id")
      .single();

    if (errorCabecera || !cabecera) {
      dudas.push("No se ha podido guardar el entreno.");
      continue;
    }

    const { data: filasEjercicio, error: errorEjercicios } = await supabase
      .from("registro_entreno_ejercicio")
      .insert(
        reconocidos.map((r, i) => ({
          user_id: user.id,
          entreno_id: cabecera.id,
          ejercicio_id: r.fila.id,
          orden: i,
        })),
      )
      .select("id, orden");

    if (errorEjercicios || !filasEjercicio) {
      dudas.push("No se han podido guardar los ejercicios del entreno.");
      continue;
    }

    const series = filasEjercicio.flatMap((fila) =>
      reconocidos[fila.orden].series.map((s, i) => ({
        user_id: user.id,
        entreno_ejercicio_id: fila.id,
        numero_serie: i + 1,
        peso: s.peso,
        repeticiones: s.repeticiones,
        // Una serie contada por chat ya se hizo: no hay nada que marcar
        // después. El default de la tabla es false porque lo pensado para la
        // sesión en vivo, donde la fila nace antes de hacerse (§5.2).
        completada: true,
      })),
    );

    const { error: errorSeries } = await supabase
      .from("registro_entreno_serie")
      .insert(series);

    if (errorSeries) {
      dudas.push("No se han podido guardar las series del entreno.");
      continue;
    }

    const nombres = reconocidos.map((r) => r.fila.nombre_canonico).join(", ");
    guardado.push(`entreno con ${reconocidos.length} ejercicios: ${nombres}`);
  }

  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/evolucion");

  if (guardado.length === 0 && dudas.length === 0 && desconocidos.size === 0) {
    return { texto, error: "No he encontrado nada registrable en el mensaje." };
  }

  return {
    guardado,
    dudas,
    ejerciciosDesconocidos: [...desconocidos],
    // Si queda algo sin resolver se devuelve el texto, para poder corregir sobre
    // lo escrito en vez de teclearlo otra vez.
    texto: dudas.length > 0 || desconocidos.size > 0 ? texto : undefined,
  };
}
