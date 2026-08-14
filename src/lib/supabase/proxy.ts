import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clavePublicaSupabase, urlSupabase } from "./env";

/** Rutas accesibles sin sesión iniciada. Todo lo demás exige login. */
const RUTAS_PUBLICAS = ["/login", "/auth"];

function esRutaPublica(pathname: string): boolean {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );
}

/**
 * Refresca la sesión y controla el acceso.
 *
 * Los tokens de Supabase caducan; sin este refresco, una pestaña abierta un
 * rato acabaría con la sesión muerta y consultas que no devuelven nada.
 */
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(urlSupabase(), clavePublicaSupabase(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesAEscribir) {
        for (const { name, value } of cookiesAEscribir) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of cookiesAEscribir) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valida el token contra el servidor. No sustituir por getSession(),
  // que se fía de una cookie que el cliente podría haber manipulado.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, searchParams } = request.nextUrl;

  // Un enlace de confirmación de email puede aterrizar en cualquier ruta, según
  // cómo esté configurada la Site URL en Supabase. Si trae código de un solo
  // uso, se encamina al handler que lo canjea — si no, se perdería y la cuenta
  // se quedaría sin confirmar sin que nada lo avisara.
  const traeCodigoAuth =
    searchParams.has("code") || searchParams.has("token_hash");

  if (traeCodigoAuth && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirmar";
    return NextResponse.redirect(url);
  }

  // Sin sesión en ruta protegida → al login, recordando a dónde iba.
  if (!user && !esRutaPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("destino", pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión en el login → a la portada.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return respuesta;
}
