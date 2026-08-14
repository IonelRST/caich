"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MOMENTOS } from "@/lib/datos/dieta";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoDieta = { error?: string; aviso?: string };

const esquemaComida = z.object({
  dia_semana: z.coerce.number().int().min(1).max(7),
  momento_dia: z.string().min(1),
  descripcion: z.string().min(1, { message: "Describe qué se come." }).max(200),
  // §6.1: al definir el plan SÍ se piden cantidades de forma sistemática. Es una
  // vez por semana y sin prisa, no cinco veces al día.
  cantidad: z.string().min(1, { message: "Indica la cantidad." }).max(60),
  calorias: z.coerce.number().min(0).max(10000).optional(),
  proteina_g: z.coerce.number().min(0).max(1000).optional(),
});

async function sesion() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Devuelve el plan de dieta del usuario, creándolo la primera vez. */
async function planDeDieta(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  userId: string,
): Promise<string | null> {
  const { data: existente } = await supabase
    .from("plantilla")
    .select("id")
    .eq("tipo", "plan_dieta")
    .eq("activa", true)
    .limit(1)
    .maybeSingle();

  if (existente) return existente.id;

  const { data: creado } = await supabase
    .from("plantilla")
    .insert({ user_id: userId, tipo: "plan_dieta", nombre: "Plan semanal" })
    .select("id")
    .single();

  return creado?.id ?? null;
}

export async function anadirComidaAlPlan(
  _previo: EstadoDieta,
  formData: FormData,
): Promise<EstadoDieta> {
  const cal = formData.get("calorias");
  const prot = formData.get("proteina_g");

  const datos = esquemaComida.safeParse({
    dia_semana: formData.get("dia_semana"),
    momento_dia: formData.get("momento_dia"),
    descripcion: formData.get("descripcion"),
    cantidad: formData.get("cantidad"),
    calorias: cal === "" ? undefined : cal,
    proteina_g: prot === "" ? undefined : prot,
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const planId = await planDeDieta(supabase, user.id);
  if (!planId) return { error: "No se ha podido crear el plan." };

  const { error } = await supabase.from("plantilla_item").insert({
    user_id: user.id,
    plantilla_id: planId,
    orden: MOMENTOS.indexOf(datos.data.momento_dia as (typeof MOMENTOS)[number]),
    dia_semana: datos.data.dia_semana,
    momento_dia: datos.data.momento_dia,
    descripcion: datos.data.descripcion,
    cantidad: datos.data.cantidad,
    calorias: datos.data.calorias ?? null,
    proteina_g: datos.data.proteina_g ?? null,
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/dieta");
  return { aviso: "Comida añadida al plan." };
}

export async function quitarComidaDelPlan(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await sesion();
  await supabase.from("plantilla_item").delete().eq("id", id);
  revalidatePath("/dieta");
}

const esquemaCheckin = z.object({
  plantilla_item_id: z.uuid(),
  adherencia: z.enum(["igual", "mas", "menos", "otra", "omitida"]),
  detalle: z.string().max(200).optional(),
});

/**
 * Check-in diario contra el plan (§6.2).
 *
 * "Igual que el plan" copia los datos ya definidos, sin estimación nueva: es
 * más preciso que describirlo por texto libre, porque las cantidades se
 * pensaron una vez con calma.
 *
 * Cualquier desviación exige detalle explícito (§6.3): es justo el dato que
 * explica por qué el resultado de la semana no cuadra con el plan, y estimarlo
 * a ojo destruiría el único valor que tiene registrarlo.
 */
export async function registrarCheckin(
  _previo: EstadoDieta,
  formData: FormData,
): Promise<EstadoDieta> {
  const detalle = formData.get("detalle");

  const datos = esquemaCheckin.safeParse({
    plantilla_item_id: formData.get("plantilla_item_id"),
    adherencia: formData.get("adherencia"),
    detalle: detalle === "" ? undefined : detalle,
  });

  if (!datos.success) return { error: "Revisa los datos del check-in." };

  const desviacion = datos.data.adherencia !== "igual" && datos.data.adherencia !== "omitida";
  if (desviacion && !datos.data.detalle) {
    return {
      error:
        "Si te has desviado del plan, indica cuánto: es el dato que explica el resultado de la semana.",
    };
  }

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { data: item } = await supabase
    .from("plantilla_item")
    .select("descripcion, cantidad, momento_dia, calorias, proteina_g")
    .eq("id", datos.data.plantilla_item_id)
    .single();

  if (!item) return { error: "Esa comida ya no está en el plan." };

  const siguePlan = datos.data.adherencia === "igual";

  const { error } = await supabase.from("registro_comida").insert({
    user_id: user.id,
    fecha_evento: new Date().toISOString(),
    origen: "plan_dieta",
    plantilla_item_id: datos.data.plantilla_item_id,
    adherencia: datos.data.adherencia,
    momento_dia: item.momento_dia,
    descripcion: siguePlan
      ? item.descripcion
      : `${item.descripcion} — ${datos.data.detalle}`,
    cantidad: siguePlan ? item.cantidad : datos.data.detalle,
    // Los macros solo se copian si se siguió el plan. En una desviación no se
    // inventan: quedan a null hasta que la IA los calcule desde el detalle.
    calorias: siguePlan ? item.calorias : null,
    proteina_g: siguePlan ? item.proteina_g : null,
    origen_dato: siguePlan ? "plan" : "declarado",
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/dieta");
  return { aviso: "Registrado." };
}
