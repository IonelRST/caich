"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = {
  error?: string;
  aviso?: string;
};

const esquemaCredenciales = z.object({
  email: z.email({ message: "Introduce un email válido." }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres." }),
});

/** Solo se aceptan rutas internas: evita redirigir a un dominio externo. */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const destino = typeof valor === "string" ? valor : "/";
  return destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";
}

/**
 * Traduce los errores de Supabase, que llegan en inglés y a veces con jerga.
 * §13: "mensajes claros si falla, sin pantallas rotas".
 *
 * Se mira primero `code`, que es estable, y solo después el texto: Supabase
 * responde "invalid login credentials" tanto para una contraseña mala como para
 * una cuenta sin confirmar (a propósito, para no revelar qué emails existen),
 * así que fiarse del texto daría un mensaje engañoso justo en ese caso.
 */
function traducirError(error: { message: string; code?: string }): string {
  if (error.code === "email_not_confirmed") {
    return "Todavía no has confirmado tu email. Revisa tu bandeja de entrada.";
  }
  if (error.code === "user_already_exists") {
    return "Ya existe una cuenta con ese email. Inicia sesión.";
  }
  if (error.code === "weak_password") {
    return "La contraseña es demasiado débil. Prueba con una más larga.";
  }

  const m = error.message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos. Si acabas de registrarte, puede que falte confirmar el email.";
  }
  if (m.includes("email not confirmed")) {
    return "Todavía no has confirmado tu email. Revisa tu bandeja de entrada.";
  }
  if (m.includes("user already registered")) {
    return "Ya existe una cuenta con ese email. Inicia sesión.";
  }
  if (m.includes("email rate limit") || m.includes("too many requests")) {
    return "Demasiados intentos. Espera un momento y vuelve a probar.";
  }
  if (m.includes("password")) {
    return "La contraseña no cumple los requisitos mínimos.";
  }
  return `No se ha podido completar la operación: ${error.message}`;
}

export async function iniciarSesion(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCredenciales.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!datos.success) {
    return { error: datos.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(datos.data);

  if (error) {
    return { error: traducirError(error) };
  }

  revalidatePath("/", "layout");
  redirect(destinoSeguro(formData.get("destino")));
}

export async function registrarse(
  _estadoPrevio: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const datos = esquemaCredenciales.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!datos.success) {
    return { error: datos.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp(datos.data);

  if (error) {
    return { error: traducirError(error) };
  }

  // Si el proyecto exige confirmación por email, la sesión llega vacía: la
  // cuenta existe pero no se puede entrar hasta confirmar.
  if (!data.session) {
    return {
      aviso:
        "Cuenta creada. Revisa tu email y confirma la dirección para poder entrar.",
    };
  }

  revalidatePath("/", "layout");
  redirect(destinoSeguro(formData.get("destino")));
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
