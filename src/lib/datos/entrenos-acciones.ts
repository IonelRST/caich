"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoRutina = { error?: string; aviso?: string };

const esquemaRutina = z.object({
  nombre: z.string().min(1, { message: "Ponle un nombre a la rutina." }).max(80),
});

const esquemaItem = z.object({
  ejercicio_id: z.uuid({ message: "Elige un ejercicio." }),
  series_objetivo: z.coerce.number().int().min(1).max(20),
  reps_objetivo: z.coerce.number().int().min(1).max(100),
  peso_objetivo: z.coerce.number().min(0).max(1000).optional(),
});

async function usuarioOFallo() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

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

export async function anadirEjercicio(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const rutinaId = formData.get("rutina_id");
  if (typeof rutinaId !== "string") return { error: "Falta la rutina." };

  const pesoBruto = formData.get("peso_objetivo");
  const datos = esquemaItem.safeParse({
    ejercicio_id: formData.get("ejercicio_id"),
    series_objetivo: formData.get("series_objetivo"),
    reps_objetivo: formData.get("reps_objetivo"),
    peso_objetivo: pesoBruto === "" ? undefined : pesoBruto,
  });
  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  // El orden va al final: se cuenta lo que ya hay en la rutina.
  const { count } = await supabase
    .from("plantilla_item")
    .select("*", { count: "exact", head: true })
    .eq("plantilla_id", rutinaId);

  const { error } = await supabase.from("plantilla_item").insert({
    user_id: user.id,
    plantilla_id: rutinaId,
    orden: count ?? 0,
    ejercicio_id: datos.data.ejercicio_id,
    series_objetivo: datos.data.series_objetivo,
    reps_objetivo: datos.data.reps_objetivo,
    peso_objetivo: datos.data.peso_objetivo ?? null,
  });

  if (error) return { error: `No se ha podido añadir: ${error.message}` };

  revalidatePath(`/rutinas/${rutinaId}`);
  return { aviso: "Ejercicio añadido." };
}

export async function quitarEjercicio(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const rutinaId = formData.get("rutina_id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  await supabase.from("plantilla_item").delete().eq("id", id);

  if (typeof rutinaId === "string") revalidatePath(`/rutinas/${rutinaId}`);
}

export async function borrarRutina(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  // Los items caen por ON DELETE CASCADE.
  await supabase.from("plantilla").delete().eq("id", id);

  revalidatePath("/rutinas");
  redirect("/rutinas");
}

/**
 * Empieza una sesión en vivo a partir de una rutina.
 *
 * Se crea con completado=false: si se cierra la pestaña o se acaba la batería
 * a mitad del entreno, la sesión sigue en la base de datos y se puede retomar
 * (§5.3). Perder una hora de entreno por cerrar el navegador sería el peor
 * fallo posible de esta pantalla.
 */
export async function empezarSesion(formData: FormData): Promise<void> {
  const rutinaId = formData.get("rutina_id");
  const { supabase, user } = await usuarioOFallo();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("registro_entreno")
    .insert({
      user_id: user.id,
      fecha_evento: new Date().toISOString(),
      origen: "sesion_en_vivo",
      plantilla_id: typeof rutinaId === "string" ? rutinaId : null,
      completado: false,
    })
    .select("id")
    .single();

  if (error || !data) redirect("/rutinas");

  // Se copian los ejercicios de la rutina a la sesión. A partir de aquí la
  // sesión es independiente: cambiar la rutina después no altera lo que ya
  // se registró, y durante la sesión se puede desviar de lo planificado (§5.2).
  if (typeof rutinaId === "string") {
    const { data: items } = await supabase
      .from("plantilla_item")
      .select("ejercicio_id, orden")
      .eq("plantilla_id", rutinaId)
      .order("orden");

    if (items && items.length > 0) {
      await supabase.from("registro_entreno_ejercicio").insert(
        items.map((it) => ({
          user_id: user.id,
          entreno_id: data.id,
          ejercicio_id: it.ejercicio_id,
          orden: it.orden,
        })),
      );
    }
  }

  revalidatePath("/entreno");
  redirect(`/entreno/${data.id}`);
}

const esquemaSerie = z.object({
  entreno_ejercicio_id: z.uuid(),
  numero_serie: z.coerce.number().int().min(1).max(50),
  peso: z.coerce.number().min(0).max(1000),
  repeticiones: z.coerce.number().int().min(0).max(200),
});

export async function registrarSerie(
  _previo: EstadoRutina,
  formData: FormData,
): Promise<EstadoRutina> {
  const datos = esquemaSerie.safeParse({
    entreno_ejercicio_id: formData.get("entreno_ejercicio_id"),
    numero_serie: formData.get("numero_serie"),
    peso: formData.get("peso"),
    repeticiones: formData.get("repeticiones"),
  });
  if (!datos.success) return { error: "Revisa el peso y las repeticiones." };

  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const entrenoId = formData.get("entreno_id");

  const { error } = await supabase.from("registro_entreno_serie").insert({
    user_id: user.id,
    entreno_ejercicio_id: datos.data.entreno_ejercicio_id,
    numero_serie: datos.data.numero_serie,
    peso: datos.data.peso,
    repeticiones: datos.data.repeticiones,
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  if (typeof entrenoId === "string") revalidatePath(`/entreno/${entrenoId}`);
  return {};
}

export async function borrarSerie(formData: FormData): Promise<void> {
  const id = formData.get("id");
  const entrenoId = formData.get("entreno_id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  await supabase.from("registro_entreno_serie").delete().eq("id", id);

  if (typeof entrenoId === "string") revalidatePath(`/entreno/${entrenoId}`);
}

export async function terminarSesion(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  await supabase
    .from("registro_entreno")
    .update({ completado: true })
    .eq("id", id);

  revalidatePath("/");
  revalidatePath("/historial");
  redirect("/");
}
