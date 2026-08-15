"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoRutina = { error?: string; aviso?: string };

const TIPOS = ["normal", "calentamiento", "fallo", "descendente"] as const;

/**
 * Aparcadero para renumerar sin chocar con el índice único de (item, número).
 * Muy por encima del tope de 20 series por ejercicio, así que ninguna fila
 * aparcada puede colisionar con una que todavía no se ha movido.
 */
const DESPLAZAMIENTO = 1000;

const esquemaRutina = z.object({
  nombre: z.string().min(1, { message: "Ponle un nombre a la rutina." }).max(80),
});

async function usuarioOFallo() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function texto(formData: FormData, clave: string): string | null {
  const v = formData.get(clave);
  return typeof v === "string" ? v : null;
}

// =============================================================================
// Rutinas (§5.1) — crear y editar
// =============================================================================

export async function crearRutina(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const datos = esquemaRutina.safeParse({ nombre: formData.get("nombre") });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { data, error } = await supabase
    .from("plantilla")
    .insert({
      user_id: user.id,
      tipo: "rutina_entreno",
      nombre: datos.data.nombre,
    })
    .select("id")
    .single();

  if (error) return { error: `No se ha podido crear: ${error.message}` };

  revalidatePath("/rutinas");
  redirect(`/rutinas/${data.id}`);
}

export async function renombrarRutina(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const id = texto(formData, "id");
  const datos = esquemaRutina.safeParse({ nombre: formData.get("nombre") });
  if (!id) return { error: "Falta la rutina." };
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase } = await usuarioOFallo();
  const { error } = await supabase
    .from("plantilla")
    .update({ nombre: datos.data.nombre, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: `No se ha podido renombrar: ${error.message}` };

  revalidatePath(`/rutinas/${id}`);
  revalidatePath("/rutinas");
  return { aviso: "Nombre actualizado." };
}

const esquemaEjercicioNuevo = z.object({
  ejercicio_id: z.uuid({ message: "Elige un ejercicio." }),
  series: z.coerce.number().int().min(1).max(20),
  reps_min: z.coerce.number().int().min(1).max(100),
  reps_max: z.coerce.number().int().min(1).max(100).optional(),
  peso_objetivo: z.coerce.number().min(0).max(1000).optional(),
  descanso_segundos: z.coerce.number().int().min(5).max(300).optional(),
});

/**
 * Añade un ejercicio a la rutina, ya con sus filas de serie (§5.1).
 *
 * El formulario pide "cuántas series" por comodidad, pero lo que se guarda son
 * N filas independientes: a partir de aquí cada una se edita por separado y
 * puede cambiar de tipo, de peso o de rango sin tocar a las demás.
 */
export async function anadirEjercicio(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const rutinaId = texto(formData, "rutina_id");
  if (!rutinaId) return { error: "Falta la rutina." };

  const opcional = (clave: string) => {
    const v = formData.get(clave);
    return v === "" || v == null ? undefined : v;
  };

  const datos = esquemaEjercicioNuevo.safeParse({
    ejercicio_id: formData.get("ejercicio_id"),
    series: formData.get("series"),
    reps_min: formData.get("reps_min"),
    reps_max: opcional("reps_max"),
    peso_objetivo: opcional("peso_objetivo"),
    descanso_segundos: opcional("descanso_segundos"),
  });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { reps_min, reps_max } = datos.data;
  if (reps_max != null && reps_max < reps_min) {
    return { error: "El rango de repeticiones va de menor a mayor." };
  }

  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { count } = await supabase
    .from("plantilla_item")
    .select("*", { count: "exact", head: true })
    .eq("plantilla_id", rutinaId);

  const { data: item, error } = await supabase
    .from("plantilla_item")
    .insert({
      user_id: user.id,
      plantilla_id: rutinaId,
      orden: count ?? 0,
      ejercicio_id: datos.data.ejercicio_id,
      descanso_segundos: datos.data.descanso_segundos ?? null,
    })
    .select("id")
    .single();

  if (error || !item) {
    return { error: `No se ha podido añadir: ${error?.message ?? ""}` };
  }

  const { error: errorSeries } = await supabase.from("plantilla_serie").insert(
    Array.from({ length: datos.data.series }, (_, i) => ({
      user_id: user.id,
      plantilla_item_id: item.id,
      numero_serie: i + 1,
      tipo: "normal",
      peso_objetivo: datos.data.peso_objetivo ?? null,
      reps_min,
      reps_max: reps_max ?? null,
    })),
  );

  if (errorSeries) {
    // El ejercicio sin series sería una fila a medias que el usuario no puede
    // arreglar desde la interfaz. Se deshace para no dejar basura.
    await supabase.from("plantilla_item").delete().eq("id", item.id);
    return { error: `No se han podido crear las series: ${errorSeries.message}` };
  }

  revalidatePath(`/rutinas/${rutinaId}`);
  return { aviso: "Ejercicio añadido." };
}

export async function quitarEjercicio(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  const rutinaId = texto(formData, "rutina_id");
  if (!id) return;

  const { supabase } = await usuarioOFallo();
  await supabase.from("plantilla_item").delete().eq("id", id);

  if (rutinaId) {
    await recolocarItems(rutinaId);
    revalidatePath(`/rutinas/${rutinaId}`);
  }
}

/** Deja los `orden` consecutivos desde 0, sin huecos. */
async function recolocarItems(rutinaId: string) {
  const { supabase } = await usuarioOFallo();
  const { data: items } = await supabase
    .from("plantilla_item")
    .select("id, orden")
    .eq("plantilla_id", rutinaId)
    .order("orden");

  await Promise.all(
    (items ?? []).map((it, i) =>
      it.orden === i
        ? Promise.resolve()
        : supabase.from("plantilla_item").update({ orden: i }).eq("id", it.id),
    ),
  );
}

/**
 * Mueve un ejercicio una posición arriba o abajo (§5.1).
 *
 * Botones y no arrastrar: el arrastre en móvil compite con el desplazamiento
 * de la página y es difícil de hacer accesible por teclado (§22.4).
 */
export async function moverEjercicio(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  const rutinaId = texto(formData, "rutina_id");
  const direccion = texto(formData, "direccion");
  if (!id || !rutinaId || (direccion !== "arriba" && direccion !== "abajo")) return;

  const { supabase } = await usuarioOFallo();
  const { data: items } = await supabase
    .from("plantilla_item")
    .select("id, orden")
    .eq("plantilla_id", rutinaId)
    .order("orden");

  if (!items) return;

  const i = items.findIndex((it) => it.id === id);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return;

  await Promise.all([
    supabase.from("plantilla_item").update({ orden: j }).eq("id", items[i].id),
    supabase.from("plantilla_item").update({ orden: i }).eq("id", items[j].id),
  ]);

  revalidatePath(`/rutinas/${rutinaId}`);
}

export async function actualizarEjercicio(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const id = texto(formData, "id");
  const rutinaId = texto(formData, "rutina_id");
  if (!id || !rutinaId) return { error: "Falta el ejercicio." };

  const descansoBruto = texto(formData, "descanso_segundos");
  const descanso =
    descansoBruto === "" || descansoBruto == null ? null : Number(descansoBruto);

  if (descanso != null && (descanso < 5 || descanso > 300)) {
    return { error: "El descanso va de 5 segundos a 5 minutos." };
  }

  const notaBruta = texto(formData, "nota");

  const { supabase } = await usuarioOFallo();
  const { error } = await supabase
    .from("plantilla_item")
    .update({
      nota: notaBruta === "" ? null : notaBruta,
      descanso_segundos: descanso,
    })
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath(`/rutinas/${rutinaId}`);
  return { aviso: "Guardado." };
}

/**
 * Agrupa un ejercicio con el anterior en un superset, o lo saca del suyo (§5.1).
 *
 * Se empareja siempre con el de arriba, que es lo que hace la referencia al
 * pedir con qué movimiento emparejarlo: en una lista ordenada, el candidato
 * natural es el contiguo. Para un superset de tres, se agrupa el tercero con
 * el segundo y hereda el grupo.
 */
export async function alternarSuperset(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  const rutinaId = texto(formData, "rutina_id");
  if (!id || !rutinaId) return;

  const { supabase } = await usuarioOFallo();
  const { data: items } = await supabase
    .from("plantilla_item")
    .select("id, orden, superset_grupo")
    .eq("plantilla_id", rutinaId)
    .order("orden");

  if (!items) return;

  const i = items.findIndex((it) => it.id === id);
  if (i < 1) return; // El primero no tiene con quién agruparse hacia arriba.

  if (items[i].superset_grupo != null) {
    await supabase
      .from("plantilla_item")
      .update({ superset_grupo: null })
      .eq("id", id);
  } else {
    const grupoPrevio = items[i - 1].superset_grupo;
    const grupo =
      grupoPrevio ??
      Math.max(0, ...items.map((it) => it.superset_grupo ?? 0)) + 1;

    await Promise.all([
      supabase
        .from("plantilla_item")
        .update({ superset_grupo: grupo })
        .eq("id", items[i - 1].id),
      supabase.from("plantilla_item").update({ superset_grupo: grupo }).eq("id", id),
    ]);
  }

  revalidatePath(`/rutinas/${rutinaId}`);
}

// =============================================================================
// Series de una rutina (§5.1)
// =============================================================================

export async function anadirSerieRutina(formData: FormData): Promise<void> {
  const itemId = texto(formData, "item_id");
  const rutinaId = texto(formData, "rutina_id");
  if (!itemId || !rutinaId) return;

  const { supabase, user } = await usuarioOFallo();
  if (!user) return;

  // La serie nueva copia la última, que es lo que casi siempre se quiere:
  // añadir una más igual. Cambiarla después es un toque.
  const { data: ultimas } = await supabase
    .from("plantilla_serie")
    .select("numero_serie, tipo, peso_objetivo, reps_min, reps_max")
    .eq("plantilla_item_id", itemId)
    .order("numero_serie", { ascending: false })
    .limit(1);

  const ultima = ultimas?.[0];

  await supabase.from("plantilla_serie").insert({
    user_id: user.id,
    plantilla_item_id: itemId,
    numero_serie: (ultima?.numero_serie ?? 0) + 1,
    tipo: ultima?.tipo ?? "normal",
    peso_objetivo: ultima?.peso_objetivo ?? null,
    reps_min: ultima?.reps_min ?? null,
    reps_max: ultima?.reps_max ?? null,
  });

  revalidatePath(`/rutinas/${rutinaId}`);
}

export async function quitarSerieRutina(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  const itemId = texto(formData, "item_id");
  const rutinaId = texto(formData, "rutina_id");
  if (!id || !itemId || !rutinaId) return;

  const { supabase } = await usuarioOFallo();
  await supabase.from("plantilla_serie").delete().eq("id", id);

  // Sin renumerar quedaría "1, 3, 4", que se lee como si faltara una serie.
  const { data: restantes } = await supabase
    .from("plantilla_serie")
    .select("id, numero_serie")
    .eq("plantilla_item_id", itemId)
    .order("numero_serie");

  // En dos pasadas: el índice único de (item, numero) chocaría a mitad de
  // camino si se reescribiera en el sitio. El aparcadero va sumando un
  // desplazamiento y no en negativo, que la tabla rechaza por su check.
  const aCambiar = (restantes ?? []).filter((s, i) => s.numero_serie !== i + 1);

  for (const s of aCambiar) {
    await supabase
      .from("plantilla_serie")
      .update({ numero_serie: s.numero_serie + DESPLAZAMIENTO })
      .eq("id", s.id);
  }
  for (const [i, s] of (restantes ?? []).entries()) {
    if (s.numero_serie === i + 1) continue;
    await supabase
      .from("plantilla_serie")
      .update({ numero_serie: i + 1 })
      .eq("id", s.id);
  }

  revalidatePath(`/rutinas/${rutinaId}`);
}

const esquemaSerieRutina = z.object({
  tipo: z.enum(TIPOS),
  peso_objetivo: z.coerce.number().min(0).max(1000).optional(),
  reps_min: z.coerce.number().int().min(1).max(100).optional(),
  reps_max: z.coerce.number().int().min(1).max(100).optional(),
});

export async function actualizarSerieRutina(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const id = texto(formData, "id");
  const rutinaId = texto(formData, "rutina_id");
  if (!id || !rutinaId) return { error: "Falta la serie." };

  const opcional = (clave: string) => {
    const v = formData.get(clave);
    return v === "" || v == null ? undefined : v;
  };

  const datos = esquemaSerieRutina.safeParse({
    tipo: formData.get("tipo"),
    peso_objetivo: opcional("peso_objetivo"),
    reps_min: opcional("reps_min"),
    reps_max: opcional("reps_max"),
  });
  if (!datos.success) return { error: "Revisa los valores de la serie." };

  const { reps_min, reps_max } = datos.data;
  if (reps_min != null && reps_max != null && reps_max < reps_min) {
    return { error: "El rango de repeticiones va de menor a mayor." };
  }

  const { supabase } = await usuarioOFallo();
  const { error } = await supabase
    .from("plantilla_serie")
    .update({
      tipo: datos.data.tipo,
      peso_objetivo: datos.data.peso_objetivo ?? null,
      reps_min: reps_min ?? null,
      reps_max: reps_max ?? null,
    })
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath(`/rutinas/${rutinaId}`);
  return {};
}

export async function borrarRutina(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  if (!id) return;

  const { supabase } = await usuarioOFallo();
  // Items y series caen por ON DELETE CASCADE.
  await supabase.from("plantilla").delete().eq("id", id);

  revalidatePath("/rutinas");
  redirect("/rutinas");
}

// =============================================================================
// Sesión en vivo (§5.2)
// =============================================================================

/**
 * Empieza una sesión en vivo a partir de una rutina.
 *
 * Se crea con completado=false: si se cierra la pestaña o se acaba la batería
 * a mitad del entreno, la sesión sigue en la base de datos y se puede retomar
 * (§5.4). Perder una hora de entreno por cerrar el navegador sería el peor
 * fallo posible de esta pantalla.
 *
 * Las series se copian del plan, no se referencian: la sesión es independiente
 * de la rutina desde el primer segundo. Editar la rutina mañana no reescribe
 * lo que pasó hoy.
 */
export async function empezarSesion(formData: FormData): Promise<void> {
  const rutinaId = texto(formData, "rutina_id");
  const { supabase, user } = await usuarioOFallo();
  if (!user) redirect("/login");

  const { data: entreno, error } = await supabase
    .from("registro_entreno")
    .insert({
      user_id: user.id,
      fecha_evento: new Date().toISOString(),
      origen: "sesion_en_vivo",
      plantilla_id: rutinaId,
      completado: false,
    })
    .select("id")
    .single();

  if (error || !entreno) redirect("/rutinas");

  if (rutinaId) {
    const { data: items } = await supabase
      .from("plantilla_item")
      .select(
        "ejercicio_id, orden, nota, descanso_segundos, superset_grupo, plantilla_serie(numero_serie, tipo, peso_objetivo, reps_min, reps_max)",
      )
      .eq("plantilla_id", rutinaId)
      .order("orden");

    for (const it of items ?? []) {
      if (!it.ejercicio_id) continue;

      const { data: fila } = await supabase
        .from("registro_entreno_ejercicio")
        .insert({
          user_id: user.id,
          entreno_id: entreno.id,
          ejercicio_id: it.ejercicio_id,
          orden: it.orden,
          nota: it.nota,
          descanso_segundos: it.descanso_segundos,
          superset_grupo: it.superset_grupo,
        })
        .select("id")
        .single();

      if (!fila) continue;

      const planificadas = (it.plantilla_serie ?? []) as {
        numero_serie: number;
        tipo: string;
        peso_objetivo: number | null;
        reps_min: number | null;
        reps_max: number | null;
      }[];

      if (planificadas.length === 0) continue;

      await supabase.from("registro_entreno_serie").insert(
        planificadas
          .slice()
          .sort((a, b) => a.numero_serie - b.numero_serie)
          .map((s) => ({
            user_id: user.id,
            entreno_ejercicio_id: fila.id,
            numero_serie: s.numero_serie,
            tipo: s.tipo,
            completada: false,
            peso: null,
            repeticiones: null,
            peso_objetivo: s.peso_objetivo,
            reps_min: s.reps_min,
            reps_max: s.reps_max,
          })),
      );
    }
  }

  revalidatePath("/entreno");
  redirect(`/entreno/${entreno.id}`);
}

/** Entreno vacío (§5.2): se arranca sin plan y se van añadiendo ejercicios. */
export async function empezarSesionVacia(): Promise<void> {
  const { supabase, user } = await usuarioOFallo();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("registro_entreno")
    .insert({
      user_id: user.id,
      fecha_evento: new Date().toISOString(),
      origen: "sesion_en_vivo",
      plantilla_id: null,
      completado: false,
    })
    .select("id")
    .single();

  if (error || !data) redirect("/rutinas");

  revalidatePath("/entreno");
  redirect(`/entreno/${data.id}`);
}

export async function anadirEjercicioSesion(formData: FormData): Promise<void> {
  const entrenoId = texto(formData, "entreno_id");
  const ejercicioId = texto(formData, "ejercicio_id");
  if (!entrenoId || !ejercicioId) return;

  const { supabase, user } = await usuarioOFallo();
  if (!user) return;

  const { count } = await supabase
    .from("registro_entreno_ejercicio")
    .select("*", { count: "exact", head: true })
    .eq("entreno_id", entrenoId);

  const { data: fila } = await supabase
    .from("registro_entreno_ejercicio")
    .insert({
      user_id: user.id,
      entreno_id: entrenoId,
      ejercicio_id: ejercicioId,
      orden: count ?? 0,
    })
    .select("id")
    .single();

  // Un ejercicio sin ninguna fila no se puede rellenar: nace con una serie.
  if (fila) {
    await supabase.from("registro_entreno_serie").insert({
      user_id: user.id,
      entreno_ejercicio_id: fila.id,
      numero_serie: 1,
      tipo: "normal",
      completada: false,
    });
  }

  revalidatePath(`/entreno/${entrenoId}`);
}

const esquemaSerie = z.object({
  peso: z.coerce.number().min(0).max(1000).optional(),
  repeticiones: z.coerce.number().int().min(0).max(200).optional(),
});

/**
 * Guarda peso y repeticiones de una serie y la marca como completada (§5.2).
 *
 * Es la acción central de la pantalla: la que dispara el temporizador de
 * descanso en el cliente y la que hace avanzar el entreno.
 */
export async function completarSerie(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const id = texto(formData, "id");
  const entrenoId = texto(formData, "entreno_id");
  if (!id) return { error: "Falta la serie." };

  const opcional = (clave: string) => {
    const v = formData.get(clave);
    return v === "" || v == null ? undefined : v;
  };

  const datos = esquemaSerie.safeParse({
    peso: opcional("peso"),
    repeticiones: opcional("repeticiones"),
  });
  if (!datos.success) return { error: "Revisa el peso y las repeticiones." };

  const completada = formData.get("completada") !== "false";

  const { supabase } = await usuarioOFallo();
  const { error } = await supabase
    .from("registro_entreno_serie")
    .update({
      peso: datos.data.peso ?? null,
      repeticiones: datos.data.repeticiones ?? null,
      completada,
    })
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  if (entrenoId) revalidatePath(`/entreno/${entrenoId}`);
  return {};
}

export async function anadirSerieSesion(formData: FormData): Promise<void> {
  const filaId = texto(formData, "entreno_ejercicio_id");
  const entrenoId = texto(formData, "entreno_id");
  if (!filaId || !entrenoId) return;

  const { supabase, user } = await usuarioOFallo();
  if (!user) return;

  const { data: ultimas } = await supabase
    .from("registro_entreno_serie")
    .select("numero_serie, tipo, peso_objetivo, reps_min, reps_max")
    .eq("entreno_ejercicio_id", filaId)
    .order("numero_serie", { ascending: false })
    .limit(1);

  const ultima = ultimas?.[0];

  await supabase.from("registro_entreno_serie").insert({
    user_id: user.id,
    entreno_ejercicio_id: filaId,
    numero_serie: (ultima?.numero_serie ?? 0) + 1,
    tipo: ultima?.tipo ?? "normal",
    completada: false,
    peso_objetivo: ultima?.peso_objetivo ?? null,
    reps_min: ultima?.reps_min ?? null,
    reps_max: ultima?.reps_max ?? null,
  });

  revalidatePath(`/entreno/${entrenoId}`);
}

export async function borrarSerie(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  const entrenoId = texto(formData, "entreno_id");
  if (!id) return;

  const filaId = texto(formData, "entreno_ejercicio_id");

  const { supabase } = await usuarioOFallo();
  await supabase.from("registro_entreno_serie").delete().eq("id", id);

  // La referencia de "la vez anterior" casa por número de serie (§5.2). Con
  // un hueco, la serie 4 de hoy se compararía la próxima vez contra la 3, que
  // es otro peso: renumerar mantiene alineadas las dos columnas.
  if (filaId) {
    const { data: restantes } = await supabase
      .from("registro_entreno_serie")
      .select("id, numero_serie")
      .eq("entreno_ejercicio_id", filaId)
      .order("numero_serie");

    for (const [i, s] of (restantes ?? []).entries()) {
      if (s.numero_serie === i + 1) continue;
      await supabase
        .from("registro_entreno_serie")
        .update({ numero_serie: i + 1 })
        .eq("id", s.id);
    }
  }

  if (entrenoId) revalidatePath(`/entreno/${entrenoId}`);
}

export async function borrarEntreno(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  if (!id) return;

  const { supabase } = await usuarioOFallo();
  // Ejercicios y series caen por ON DELETE CASCADE.
  await supabase.from("registro_entreno").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/historial");
}

/** Descartar la sesión (§5.2). El borrado en cascada se lleva todo lo tecleado. */
export async function descartarSesion(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  if (!id) return;

  const { supabase } = await usuarioOFallo();
  await supabase.from("registro_entreno").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/rutinas");
  redirect("/rutinas");
}

/** Terminar lleva a la pantalla de cierre (§5.3), no guarda todavía. */
export async function terminarSesion(formData: FormData): Promise<void> {
  const id = texto(formData, "id");
  if (!id) return;
  redirect(`/entreno/${id}/cierre`);
}

// =============================================================================
// Cierre de sesión (§5.3)
// =============================================================================

/**
 * Cierra la sesión y, si se pide, vuelca su forma sobre la rutina de origen.
 *
 * La plantilla solo se toca con confirmación explícita: es la diferencia entre
 * "hoy hice una serie de más" y "a partir de ahora esta rutina lleva una serie
 * más". Confundirlas reescribiría el plan por un día suelto.
 */
export async function guardarCierre(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const id = texto(formData, "id");
  if (!id) return { error: "Falta la sesión." };

  const fecha = texto(formData, "fecha_evento");
  const notas = texto(formData, "notas");
  const actualizarPlantilla = formData.get("actualizar_plantilla") === "si";

  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const cambios: Record<string, unknown> = {
    completado: true,
    notas: notas === "" ? null : notas,
  };

  if (fecha) {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return { error: "La fecha no es válida." };
    cambios.fecha_evento = d.toISOString();
  }

  const { error } = await supabase
    .from("registro_entreno")
    .update(cambios)
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  // Las series que se quedaron sin marcar no llegaron a hacerse: se descartan
  // para que no cuenten como entrenadas en el histórico ni en los insights.
  const { data: filas } = await supabase
    .from("registro_entreno_ejercicio")
    .select("id")
    .eq("entreno_id", id);

  const idsFila = (filas ?? []).map((f) => f.id);

  if (idsFila.length > 0) {
    await supabase
      .from("registro_entreno_serie")
      .delete()
      .in("entreno_ejercicio_id", idsFila)
      .eq("completada", false);
  }

  if (actualizarPlantilla) await volcarSesionEnPlantilla(id, user.id);

  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/rutinas");
  redirect("/historial");
}

async function volcarSesionEnPlantilla(entrenoId: string, userId: string) {
  const { supabase } = await usuarioOFallo();

  const { data: entreno } = await supabase
    .from("registro_entreno")
    .select("plantilla_id")
    .eq("id", entrenoId)
    .single();

  if (!entreno?.plantilla_id) return;

  const { data: filas } = await supabase
    .from("registro_entreno_ejercicio")
    .select(
      "ejercicio_id, orden, nota, descanso_segundos, superset_grupo, registro_entreno_serie(numero_serie, tipo, peso, repeticiones)",
    )
    .eq("entreno_id", entrenoId)
    .order("orden");

  if (!filas) return;

  // Se reescribe la rutina entera en lugar de casar item por item: la sesión
  // pudo añadir, quitar y reordenar ejercicios, y reconciliar eso a mano deja
  // más sitios donde equivocarse que rehacerla desde lo que de verdad se hizo.
  await supabase
    .from("plantilla_item")
    .delete()
    .eq("plantilla_id", entreno.plantilla_id);

  for (const [i, f] of filas.entries()) {
    const { data: item } = await supabase
      .from("plantilla_item")
      .insert({
        user_id: userId,
        plantilla_id: entreno.plantilla_id,
        orden: i,
        ejercicio_id: f.ejercicio_id,
        nota: f.nota,
        descanso_segundos: f.descanso_segundos,
        superset_grupo: f.superset_grupo,
      })
      .select("id")
      .single();

    if (!item) continue;

    const series = (f.registro_entreno_serie ?? []) as {
      numero_serie: number;
      tipo: string;
      peso: number | null;
      repeticiones: number | null;
    }[];

    if (series.length === 0) continue;

    await supabase.from("plantilla_serie").insert(
      series
        .slice()
        .sort((a, b) => a.numero_serie - b.numero_serie)
        .map((s, n) => ({
          user_id: userId,
          plantilla_item_id: item.id,
          numero_serie: n + 1,
          tipo: s.tipo,
          peso_objetivo: s.peso,
          reps_min: s.repeticiones,
          reps_max: null,
        })),
    );
  }

  await supabase
    .from("plantilla")
    .update({ actualizado_en: new Date().toISOString() })
    .eq("id", entreno.plantilla_id);
}
