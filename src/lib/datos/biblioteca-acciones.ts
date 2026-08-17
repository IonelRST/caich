"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Biblioteca de comidas (§6.1) y registro de un toque desde ella (§6.2).
 *
 * La unidad es la comida guardada, no la casilla de un día de la semana. Los
 * macros se calculan una vez, al crearla, y de ahí en adelante registrar cuesta
 * un toque.
 *
 * Editar una comida NO reescribe los registros pasados que la usaron: lo que se
 * comió el martes no cambia porque hoy se corrija la receta. Por eso el registro
 * copia los valores en vez de apuntar a la comida para leerlos.
 */

export type EstadoBiblioteca = { error?: string; aviso?: string };

export type ComidaGuardada = {
  id: string;
  nombre: string;
  cantidad: string;
  calorias: number | null;
  proteina_g: number | null;
  veces_registrada: number;
  ultima_vez: string | null;
};

const esquemaComida = z.object({
  nombre: z.string().min(1, { message: "Ponle nombre a la comida." }).max(80),
  // §6.1: la cantidad es obligatoria al crear. Es una vez por comida, no cinco
  // veces al día, y es de donde salen unos macros que valgan algo.
  cantidad: z
    .string()
    .min(1, { message: "Indica los alimentos y sus cantidades." })
    .max(300),
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

function opcional(valor: FormDataEntryValue | null) {
  return valor === "" || valor === null ? undefined : valor;
}

export async function guardarComida(
  _previo: EstadoBiblioteca,
  formData: FormData,
): Promise<EstadoBiblioteca> {
  const datos = esquemaComida.safeParse({
    nombre: formData.get("nombre"),
    cantidad: formData.get("cantidad"),
    calorias: opcional(formData.get("calorias")),
    proteina_g: opcional(formData.get("proteina_g")),
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const id = formData.get("id");
  const campos = {
    nombre: datos.data.nombre,
    cantidad: datos.data.cantidad,
    calorias: datos.data.calorias ?? null,
    proteina_g: datos.data.proteina_g ?? null,
  };

  // Mismo formulario para crear y para editar: con `id` actualiza, sin él crea.
  const { error } =
    typeof id === "string" && id.length > 0
      ? await supabase.from("comida_guardada").update(campos).eq("id", id)
      : await supabase
          .from("comida_guardada")
          .insert({ user_id: user.id, ...campos });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/dieta");
  return { aviso: id ? "Comida actualizada." : "Comida guardada." };
}

/**
 * Clave de comparación entre comidas (§6.6).
 *
 * La detección es por descripción equivalente, no por texto idéntico: sin
 * normalizar, "Pollo con arroz" y "pollo con  arroz" serían dos comidas
 * distintas y no se detectaría ninguna repetición.
 */
export async function claveDeComida(descripcion: string): Promise<string> {
  return descripcion
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type Sugerencia = {
  clave: string;
  nombre: string;
  cantidad: string;
  calorias: number | null;
  proteina_g: number | null;
};

/**
 * Acepta la oferta: crea la comida en la biblioteca (§6.6).
 *
 * Las cantidades vienen del primer registro, no del segundo: es donde el
 * usuario las escribió con detalle, y repetir algo no suele volver a
 * describirlo entero.
 */
export async function aceptarSugerencia(
  formData: FormData,
): Promise<EstadoBiblioteca> {
  const nombre = formData.get("nombre");
  const cantidad = formData.get("cantidad");
  if (typeof nombre !== "string" || typeof cantidad !== "string") {
    return { error: "Faltan datos de la comida." };
  }

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const num = (clave: string) => {
    const v = formData.get(clave);
    return v === "" || v == null ? null : Number(v);
  };

  const { error } = await supabase.from("comida_guardada").insert({
    user_id: user.id,
    nombre,
    cantidad,
    calorias: num("calorias"),
    proteina_g: num("proteina_g"),
  });

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/dieta");
  return { aviso: `${nombre} está ya en tu biblioteca.` };
}

/** Rechaza la oferta y no vuelve a preguntar por esa comida (§6.6). */
export async function descartarSugerencia(
  formData: FormData,
): Promise<EstadoBiblioteca> {
  const clave = formData.get("clave");
  if (typeof clave !== "string") return { error: "Falta la comida." };

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  await supabase
    .from("comida_sugerencia_descartada")
    .insert({ user_id: user.id, clave });

  return { aviso: "No volveré a proponerla." };
}

export async function borrarComida(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const { supabase } = await sesion();
  await supabase.from("comida_guardada").delete().eq("id", id);
  revalidatePath("/dieta");
}

/**
 * Registrar una comida de la biblioteca (§6.2). El camino de un toque.
 *
 * Los macros se copian al registro en vez de referenciarse, por lo dicho arriba
 * sobre editar. `origen_dato` es "declarado" y no "estimado": las cantidades las
 * escribió el usuario al crear la comida, no las adivinó nadie (§4.2).
 */
export async function registrarComida(
  formData: FormData,
): Promise<EstadoBiblioteca> {
  const id = formData.get("comida_id");
  if (typeof id !== "string") return { error: "Falta la comida." };

  const { supabase, user } = await sesion();
  if (!user) return { error: "Tu sesión ha caducado. Vuelve a entrar." };

  const { data: comida } = await supabase
    .from("comida_guardada")
    .select("id, nombre, cantidad, calorias, proteina_g, veces_registrada")
    .eq("id", id)
    .single();

  if (!comida) return { error: "Esa comida ya no está en tu biblioteca." };

  const ahora = new Date().toISOString();

  const { error } = await supabase.from("registro_comida").insert({
    user_id: user.id,
    fecha_evento: ahora,
    origen: "biblioteca",
    comida_guardada_id: comida.id,
    descripcion: comida.nombre,
    cantidad: comida.cantidad,
    calorias: comida.calorias,
    proteina_g: comida.proteina_g,
    origen_dato: "declarado",
  });

  if (error) return { error: `No se ha podido registrar: ${error.message}` };

  // §6.1: el orden de la lista sale del uso. Que esto falle no invalida el
  // registro, que ya está guardado, así que no se propaga como error.
  await supabase
    .from("comida_guardada")
    .update({
      veces_registrada: comida.veces_registrada + 1,
      ultima_vez: ahora,
    })
    .eq("id", comida.id);

  revalidatePath("/dieta");
  revalidatePath("/historial");
  return { aviso: `${comida.nombre} registrada.` };
}
