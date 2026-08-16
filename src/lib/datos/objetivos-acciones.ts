"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoObjetivo = { error?: string; aviso?: string };

const esquema = z.object({
  descripcion: z
    .string()
    .min(1, { message: "Describe el objetivo." })
    .max(120),
  metrica: z.string().min(3, { message: "Elige qué métrica sigue." }),
  valor_objetivo: z.coerce
    .number({ message: "El valor tiene que ser un número." })
    .positive({ message: "El valor tiene que ser mayor que cero." }),
  unidad: z.string().min(1),
  direccion: z.enum(["subir", "bajar"]),
  fecha_objetivo: z.string().optional(),
});

export async function crearObjetivo(
  _previo: EstadoObjetivo,
  formData: FormData,
): Promise<EstadoObjetivo> {
  const fecha = formData.get("fecha_objetivo");

  const datos = esquema.safeParse({
    descripcion: formData.get("descripcion"),
    metrica: formData.get("metrica"),
    valor_objetivo: formData.get("valor_objetivo"),
    unidad: formData.get("unidad"),
    direccion: formData.get("direccion"),
    fecha_objetivo: fecha === "" ? undefined : fecha,
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { error } = await supabase.from("objetivo").insert({
    user_id: user.id,
    descripcion: datos.data.descripcion,
    metrica: datos.data.metrica,
    valor_objetivo: datos.data.valor_objetivo,
    unidad: datos.data.unidad,
    direccion: datos.data.direccion,
    fecha_objetivo: datos.data.fecha_objetivo ?? null,
  });

  if (error) return { error: `No se ha podido crear: ${error.message}` };

  revalidatePath("/objetivos");
  return { aviso: "Objetivo creado." };
}

/**
 * Corregir un objetivo ya creado (§9, punto 22 de la §19).
 *
 * No se toca `cumplido_en`: marcarlo cumplido y corregir su enunciado son dos
 * cosas distintas, y editar la meta de un objetivo ya cumplido no debe
 * resucitarlo. Para eso está `marcarCumplido`, que es su propia acción.
 */
export async function actualizarObjetivo(
  _previo: EstadoObjetivo,
  formData: FormData,
): Promise<EstadoObjetivo> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Falta el objetivo." };

  const fecha = formData.get("fecha_objetivo");

  const datos = esquema.safeParse({
    descripcion: formData.get("descripcion"),
    metrica: formData.get("metrica"),
    valor_objetivo: formData.get("valor_objetivo"),
    unidad: formData.get("unidad"),
    direccion: formData.get("direccion"),
    fecha_objetivo: fecha === "" ? undefined : fecha,
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("objetivo")
    .update({
      descripcion: datos.data.descripcion,
      metrica: datos.data.metrica,
      valor_objetivo: datos.data.valor_objetivo,
      unidad: datos.data.unidad,
      direccion: datos.data.direccion,
      fecha_objetivo: datos.data.fecha_objetivo ?? null,
    })
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/objetivos");
  return { aviso: "Corregido." };
}

export async function borrarObjetivo(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await crearClienteServidor();
  await supabase.from("objetivo").delete().eq("id", id);
  revalidatePath("/objetivos");
}

/** Un objetivo cumplido se marca, no se borra: queda en el histórico (§9.2). */
export async function marcarCumplido(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await crearClienteServidor();
  await supabase
    .from("objetivo")
    .update({ cumplido_en: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/objetivos");
}
