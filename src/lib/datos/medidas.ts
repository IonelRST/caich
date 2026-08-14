/**
 * Tipos y constantes de medidas corporales.
 *
 * Deliberadamente separado de medidas-acciones.ts: un archivo "use server" solo
 * puede exportar funciones async, así que las constantes compartidas entre
 * servidor y cliente tienen que vivir fuera de él.
 */

export type MedidaHabitual = {
  nombre: string;
  etiqueta: string;
  unidad: string;
};

/**
 * Medidas frecuentes con su unidad por defecto. El modelo de datos es abierto
 * (§4.3: nombre + valor + unidad), así que esto es solo una ayuda de la
 * interfaz — no una lista cerrada de lo que se puede registrar.
 */
export const MEDIDAS_HABITUALES: readonly MedidaHabitual[] = [
  { nombre: "peso", etiqueta: "Peso corporal", unidad: "kg" },
  { nombre: "grasa_corporal", etiqueta: "% de grasa", unidad: "%" },
  { nombre: "cintura", etiqueta: "Cintura", unidad: "cm" },
  { nombre: "pecho", etiqueta: "Pecho", unidad: "cm" },
  { nombre: "brazo", etiqueta: "Brazo", unidad: "cm" },
];

export function etiquetaDeMedida(nombre: string): string {
  return MEDIDAS_HABITUALES.find((m) => m.nombre === nombre)?.etiqueta ?? nombre;
}
