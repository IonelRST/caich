import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Callback de autenticación: canjea el código del email por una sesión.
 *
 * Cuando Supabase envía el correo de confirmación, el enlace devuelve al
 * usuario aquí con un código de un solo uso. Sin este canje la cuenta nunca
 * queda confirmada, y el login falla — además con un mensaje engañoso, porque
 * Supabase responde "credenciales inválidas" en vez de "email sin confirmar"
 * (deliberadamente: así no revela qué emails están registrados).
 *
 * Tiene que ser un Route Handler y no un Server Component: el canje escribe
 * las cookies de sesión, y los Server Components no pueden escribir cookies.
 *
 * Soporta los dos formatos de enlace que usa Supabase según la plantilla:
 *   ?code=…                  → flujo PKCE
 *   ?token_hash=…&type=email → plantillas de correo más recientes
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Solo rutas internas: un enlace manipulado no puede llevar a otro dominio.
  const destinoParam = searchParams.get("destino") ?? "/";
  const destino =
    destinoParam.startsWith("/") && !destinoParam.startsWith("//")
      ? destinoParam
      : "/";

  const supabase = await crearClienteServidor();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(destino, origin));
    }
    return redirigirConError(origin, error.message);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(destino, origin));
    }
    return redirigirConError(origin, error.message);
  }

  return redirigirConError(origin, "El enlace de confirmación no es válido.");
}

function redirigirConError(origin: string, mensaje: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", mensaje);
  return NextResponse.redirect(url);
}
