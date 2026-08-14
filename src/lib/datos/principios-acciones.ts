"use server";

import { revalidatePath } from "next/cache";
import { generarBorradorPrincipios } from "@/lib/ia/principios";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoPrincipios = { error?: string; aviso?: string };

async function usuarioOFallo() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Pide a la IA el borrador inicial y lo guarda SIN aprobar (§11.4).
 *
 * Se niega a generar si ya hay principios: regenerar encima borraría un repaso
 * que el usuario ya hizo, y ese repaso es justamente lo que da valor a la base.
 */
export async function generarPrincipios(): Promise<EstadoPrincipios> {
  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { count } = await supabase
    .from("principio_base")
    .select("*", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    return { error: "Ya tienes principios. Borra los que no quieras y añade a mano." };
  }

  let borrador;
  try {
    borrador = await generarBorradorPrincipios();
  } catch (fallo) {
    return {
      error:
        fallo instanceof Error
          ? `No se ha podido generar el borrador: ${fallo.message}`
          : "No se ha podido generar el borrador.",
    };
  }

  const { error } = await supabase.from("principio_base").insert(
    borrador.map((p, i) => ({
      user_id: user.id,
      enunciado: p.enunciado,
      ambito: p.ambito,
      aprobado: false,
      orden: i,
    })),
  );

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/principios");
  return {
    aviso: `${borrador.length} principios redactados. Revísalos y aprueba los que valgan.`,
  };
}

export async function aprobarPrincipio(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  await supabase
    .from("principio_base")
    .update({ aprobado: true, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/principios");
  revalidatePath("/insights");
}

export async function retirarPrincipio(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  await supabase
    .from("principio_base")
    .update({ aprobado: false, actualizado_en: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/principios");
  revalidatePath("/insights");
}

export async function borrarPrincipio(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await usuarioOFallo();
  await supabase.from("principio_base").delete().eq("id", id);

  revalidatePath("/principios");
  revalidatePath("/insights");
}

/**
 * Añadir o corregir un principio a mano.
 *
 * Lo que el usuario escribe entra ya aprobado: si lo redacta él, el repaso que
 * exige §11.4 ya ha ocurrido.
 */
export async function guardarPrincipio(
  _previo: EstadoPrincipios,
  formData: FormData,
): Promise<EstadoPrincipios> {
  const enunciado = formData.get("enunciado");
  const ambito = formData.get("ambito");
  const id = formData.get("id");

  if (typeof enunciado !== "string" || enunciado.trim().length < 20) {
    return { error: "El enunciado es demasiado corto." };
  }
  if (
    ambito !== "entrenamiento" &&
    ambito !== "nutricion" &&
    ambito !== "recuperacion"
  ) {
    return { error: "Elige un ámbito." };
  }

  const { supabase, user } = await usuarioOFallo();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  if (typeof id === "string" && id.length > 0) {
    const { error } = await supabase
      .from("principio_base")
      .update({
        enunciado: enunciado.trim(),
        ambito,
        aprobado: true,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { error: `No se ha podido guardar: ${error.message}` };
    revalidatePath("/principios");
    revalidatePath("/insights");
    return { aviso: "Principio actualizado." };
  }

  const { count } = await supabase
    .from("principio_base")
    .select("*", { count: "exact", head: true });

  const { error } = await supabase.from("principio_base").insert({
    user_id: user.id,
    enunciado: enunciado.trim(),
    ambito,
    aprobado: true,
    orden: count ?? 0,
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/principios");
  revalidatePath("/insights");
  return { aviso: "Principio añadido." };
}
