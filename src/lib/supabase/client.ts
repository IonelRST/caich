import { createBrowserClient } from "@supabase/ssr";
import { clavePublicaSupabase, urlSupabase } from "./env";

/**
 * Cliente de Supabase para componentes de navegador ("use client").
 *
 * Usa la publishable key, que es pública por diseño. Lo que aísla los datos no
 * es el secreto de esta clave, sino Row Level Security (migración 0001): cada
 * consulta se filtra por auth.uid() en la propia base de datos.
 */
export function crearClienteNavegador() {
  return createBrowserClient(urlSupabase(), clavePublicaSupabase());
}
