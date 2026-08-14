import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { clavePublicaSupabase, urlSupabase } from "./env";

/**
 * Cliente de Supabase para el servidor (Server Components, Server Actions y
 * Route Handlers).
 *
 * La sesión viaja en cookies. Este cliente las lee para que las consultas se
 * hagan como el usuario autenticado — sin eso, RLS no devolvería ninguna fila.
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(urlSupabase(), clavePublicaSupabase(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesAEscribir) {
        try {
          for (const { name, value, options } of cookiesAEscribir) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. No es un fallo:
          // el middleware ya refresca la sesión en cada petición.
        }
      },
    },
  });
}

/**
 * Devuelve el usuario autenticado, o null.
 *
 * Usa getUser() y no getSession(): getUser() valida el token contra el servidor
 * de Supabase, mientras que getSession() se fía de la cookie, que el cliente
 * podría haber manipulado. Para decidir accesos, siempre getUser().
 */
export async function usuarioActual() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
