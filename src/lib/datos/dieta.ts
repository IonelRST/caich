/**
 * Constantes del plan de dieta.
 *
 * Separado de dieta-acciones.ts porque un archivo "use server" solo puede
 * exportar funciones async — exportar constantes desde ahí rompe el build con
 * un error poco descriptivo ("Failed to collect page data").
 */

export const MOMENTOS = [
  "Desayuno",
  "Media mañana",
  "Comida",
  "Merienda",
  "Cena",
] as const;

export const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

/** Lunes = 1 … Domingo = 7 (getDay() da 0 para domingo). */
export function diaSemanaHoy(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}
