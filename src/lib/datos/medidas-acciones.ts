"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoMedida = {
  error?: string;
  aviso?: string;
};

const esquemaMedida = z.object({
  nombre: z.string().min(1, { message: "Elige qué estás midiendo." }),
  valor: z.coerce
    .number({ message: "El valor tiene que ser un número." })
    .positive({ message: "El valor tiene que ser mayor que cero." })
    .max(1000, { message: "Ese valor no parece correcto." }),
  unidad: z.string().min(1, { message: "Falta la unidad." }),
  fecha: z.string().min(1, { message: "Falta la fecha." }),
});

export async function registrarMedida(
  _previo: EstadoMedida,
  formData: FormData,
): Promise<EstadoMedida> {
  const datos = esquemaMedida.safeParse({
    nombre: formData.get("nombre"),
    valor: formData.get("valor"),
    unidad: formData.get("unidad"),
    fecha: formData.get("fecha"),
  });

  if (!datos.success) {
    return { error: datos.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión ha caducado. Vuelve a entrar." };
  }

  // La fecha del formulario es solo día (YYYY-MM-DD). Se guarda a mediodía para
  // que un cambio de huso horario no desplace el registro al día anterior.
  const fechaEvento = new Date(`${datos.data.fecha}T12:00:00`);

  const { error } = await supabase.from("registro_medida").insert({
    user_id: user.id,
    fecha_evento: fechaEvento.toISOString(),
    origen: "edicion_manual",
    nombre: datos.data.nombre,
    valor: datos.data.valor,
    unidad: datos.data.unidad,
  });

  if (error) {
    return { error: `No se ha podido guardar: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/historial");
  return { aviso: "Guardado." };
}

/**
 * Corregir una medida ya registrada (§8: el historial tiene edición).
 *
 * No se toca `origen` ni `mensaje_original`: corregir el valor de un peso que
 * se dictó por chat no lo convierte en un dato tecleado a mano, y el texto
 * original sigue siendo la prueba de qué se dijo. Es la diferencia con borrar y
 * volver a crear, que era la única salida hasta ahora y perdía las dos cosas.
 */
export async function actualizarMedida(
  _previo: EstadoMedida,
  formData: FormData,
): Promise<EstadoMedida> {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Falta el registro." };

  const datos = esquemaMedida.safeParse({
    nombre: formData.get("nombre"),
    valor: formData.get("valor"),
    unidad: formData.get("unidad"),
    fecha: formData.get("fecha"),
  });

  if (!datos.success) return { error: datos.error.issues[0].message };

  const supabase = await crearClienteServidor();

  const { error } = await supabase
    .from("registro_medida")
    .update({
      fecha_evento: new Date(`${datos.data.fecha}T12:00:00`).toISOString(),
      nombre: datos.data.nombre,
      valor: datos.data.valor,
      unidad: datos.data.unidad,
    })
    .eq("id", id);

  if (error) return { error: `No se ha podido guardar: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/historial");
  revalidatePath("/evolucion");
  return { aviso: "Corregido." };
}

export async function borrarMedida(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await crearClienteServidor();

  // No hace falta filtrar por user_id: RLS solo deja borrar filas propias.
  // Un id de otro usuario simplemente no borraría nada.
  await supabase.from("registro_medida").delete().eq("id", id);

  revalidatePath("/");
  revalidatePath("/historial");
}
