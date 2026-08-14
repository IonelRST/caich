/**
 * Lectura validada de las variables de entorno de Supabase.
 *
 * Sin esto, una variable ausente produce un error opaco en tiempo de ejecución
 * (normalmente un fetch a "undefined/auth/v1/..."). Aquí falla pronto y dice
 * exactamente qué falta.
 */

function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        `Cópiala de .env.example a .env.local y rellénala (ver README, "Puesta en marcha").`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  const url = requerida(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  // El panel de Supabase muestra el "RESTful endpoint" (…/rest/v1) junto a la
  // Project URL, y es fácil copiar el que no es. El cliente añade esa ruta por
  // su cuenta, así que aquí se descarta para evitar /rest/v1/rest/v1/…
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export function clavePublicaSupabase(): string {
  return requerida(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
