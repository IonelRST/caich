"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MOMENTOS } from "@/lib/datos/dieta";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoDieta = { error?: string; aviso?: string };

/**
 * §6.4: el plan asigna comidas que YA existen en la biblioteca. No se define
 * comida nueva desde aquí: se define en la biblioteca (§6.1) y se coloca en un
 * día. Antes el plan repetía descripción, cantidad y macros por su cuenta, así
 * que la misma comida existía dos veces y corregirla en un sitio no la
 * corregía en el otro.
 */
const esquemaComida = z.object({
  dia_semana: z.coerce.number().int().min(1).max(7),
  momento_dia: z.string().min(1),
  comida_guardada_id: z.uuid({ message: "Elige una comida de tu biblioteca." }),
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
  const datos = esquemaComida.safeParse({
    dia_semana: formData.get("dia_semana"),
    momento_dia: formData.get("momento_dia"),
    comida_guardada_id: formData.get("comida_guardada_id"),
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const planId = await planDeDieta(supabase, user.id);
  if (!planId) return { error: "No se ha podido crear el plan." };

  // Se guarda el enlace, no una copia. Corregir la comida en la biblioteca
  // corrige también lo que el plan promete para el jueves.
  const { error } = await supabase.from("plantilla_item").insert({
    user_id: user.id,
    plantilla_id: planId,
    orden: MOMENTOS.indexOf(datos.data.momento_dia as (typeof MOMENTOS)[number]),
    dia_semana: datos.data.dia_semana,
    momento_dia: datos.data.momento_dia,
    comida_guardada_id: datos.data.comida_guardada_id,
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/dieta");
  return { aviso: "Comida añadida al plan." };
}

const esquemaComidaRegistrada = z.object({
  descripcion: z.string().min(1, { message: "Describe qué comiste." }).max(200),
  cantidad: z.string().max(60).optional(),
  calorias: z.coerce.number().min(0).max(10000).optional(),
  proteina_g: z.coerce.number().min(0).max(1000).optional(),
  fecha: z.string().min(1, { message: "Falta la fecha." }),
});

/**
 * Corregir una comida ya registrada (§8: el historial tiene edición).
 *
 * No se toca `origen` ni `mensaje_original`: corregir la cantidad de algo que
 * se dictó por chat no lo convierte en un dato tecleado a mano, y el texto
 * original sigue siendo la prueba de qué se dijo.
 *
 * `origen_dato` sí puede subir de "estimado" a "declarado" (§4.2): si el
 * usuario escribe la cantidad a mano, deja de ser una estimación de la IA y los
 * insights tienen derecho a tratarla como dato declarado. Nunca baja.
 */
export async function actualizarComidaRegistrada(
  _previo: EstadoDieta,
  formData: FormData,
): Promise<EstadoDieta> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Falta el registro." };

  const cantidad = formData.get("cantidad");
  const cal = formData.get("calorias");
  const prot = formData.get("proteina_g");

  const datos = esquemaComidaRegistrada.safeParse({
    descripcion: formData.get("descripcion"),
    cantidad: cantidad === "" ? undefined : cantidad,
    calorias: cal === "" ? undefined : cal,
    proteina_g: prot === "" ? undefined : prot,
    fecha: formData.get("fecha"),
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase } = await sesion();

  const { data: actual } = await supabase
    .from("registro_comida")
    .select("origen_dato")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("registro_comida")
    .update({
      fecha_evento: new Date(`${datos.data.fecha}T12:00:00`).toISOString(),
      descripcion: datos.data.descripcion,
      cantidad: datos.data.cantidad ?? null,
      calorias: datos.data.calorias ?? null,
      proteina_g: datos.data.proteina_g ?? null,
      origen_dato:
        actual?.origen_dato === "estimado" && datos.data.cantidad
          ? "declarado"
          : actual?.origen_dato,
    })
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/dieta");
  return { aviso: "Corregido." };
}

/**
 * Borrar una comida ya registrada (§8: el historial tiene borrado).
 *
 * Es lo simétrico de `borrarMedida` y `borrarEntreno`, que existían desde el
 * principio. Faltaba solo para comida, y con el registro de un toque de la §6.2
 * eso pasó de hueco a problema: un toque de más era un dato que no se podía
 * deshacer desde la app.
 *
 * No se descuenta `veces_registrada` de la comida guardada: ese contador ordena
 * la biblioteca por costumbre de uso, y borrar un registro equivocado no
 * significa que la comida se use menos.
 */
export async function borrarComidaRegistrada(
  formData: FormData,
): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await sesion();
  await supabase.from("registro_comida").delete().eq("id", id);

  revalidatePath("/historial");
  revalidatePath("/dieta");
  revalidatePath("/");
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
    .select(
      "descripcion, cantidad, momento_dia, calorias, proteina_g, comida_guardada_id, comida_guardada(nombre, cantidad, calorias, proteina_g)",
    )
    .eq("id", datos.data.plantilla_item_id)
    .single();

  if (!item) return { error: "Esa comida ya no está en el plan." };

  // Los items enlazados a la biblioteca (§6.4) leen de ella; los antiguos
  // conservan sus propios campos, así que un plan de antes sigue funcionando.
  const enlazada = item.comida_guardada as unknown as {
    nombre: string;
    cantidad: string;
    calorias: number | null;
    proteina_g: number | null;
  } | null;

  const plan = enlazada
    ? {
        descripcion: enlazada.nombre,
        cantidad: enlazada.cantidad,
        calorias: enlazada.calorias,
        proteina_g: enlazada.proteina_g,
      }
    : {
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        calorias: item.calorias,
        proteina_g: item.proteina_g,
      };

  const siguePlan = datos.data.adherencia === "igual";

  const { error } = await supabase.from("registro_comida").insert({
    user_id: user.id,
    fecha_evento: new Date().toISOString(),
    origen: "plan_dieta",
    plantilla_item_id: datos.data.plantilla_item_id,
    adherencia: datos.data.adherencia,
    momento_dia: item.momento_dia,
    comida_guardada_id: item.comida_guardada_id ?? null,
    descripcion: siguePlan
      ? plan.descripcion
      : `${plan.descripcion} — ${datos.data.detalle}`,
    cantidad: siguePlan ? plan.cantidad : datos.data.detalle,
    // Los macros solo se copian si se siguió el plan. En una desviación no se
    // inventan: quedan a null hasta que la IA los calcule desde el detalle.
    calorias: siguePlan ? plan.calorias : null,
    proteina_g: siguePlan ? plan.proteina_g : null,
    origen_dato: siguePlan ? "plan" : "declarado",
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/dieta");
  return { aviso: "Registrado." };
}
