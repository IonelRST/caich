/**
 * Objetivos con modelo genérico (§9.1).
 *
 * La métrica es una cadena "familia:clave", no un enum: así cualquier medida o
 * ejercicio puede convertirse en objetivo sin tocar el esquema de datos.
 *   measurement:peso        · measurement:cintura
 *   exercise_pr:<uuid>      · nutrition:proteina_diaria
 *   training:sesiones_semanales
 */

export type Objetivo = {
  id: string;
  descripcion: string;
  metrica: string;
  valor_objetivo: number;
  unidad: string;
  direccion: "subir" | "bajar";
  fecha_objetivo: string | null;
  cumplido_en: string | null;
};

export type ProgresoObjetivo = {
  objetivo: Objetivo;
  valorActual: number | null;
  /** 0–100. null si todavía no hay ningún dato de esa métrica. */
  porcentaje: number | null;
  alcanzado: boolean;
};

export function familiaDeMetrica(metrica: string): string {
  return metrica.split(":")[0] ?? "";
}

export function claveDeMetrica(metrica: string): string {
  return metrica.slice(metrica.indexOf(":") + 1);
}

/**
 * Progreso contra un objetivo, tomando como punto de partida el primer valor
 * registrado. Sin ese punto de partida un objetivo de bajar peso mostraría un
 * porcentaje absurdo (77 de 75 kg no es "102 % conseguido").
 */
export function calcularProgreso(
  objetivo: Objetivo,
  valorActual: number | null,
  valorInicial: number | null,
): ProgresoObjetivo {
  if (valorActual == null) {
    return { objetivo, valorActual: null, porcentaje: null, alcanzado: false };
  }

  const alcanzado =
    objetivo.direccion === "bajar"
      ? valorActual <= objetivo.valor_objetivo
      : valorActual >= objetivo.valor_objetivo;

  const inicial = valorInicial ?? valorActual;
  const recorridoTotal = Math.abs(objetivo.valor_objetivo - inicial);
  const recorrido = Math.abs(valorActual - inicial);

  const porcentaje = alcanzado
    ? 100
    : recorridoTotal === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((recorrido / recorridoTotal) * 100)));

  return { objetivo, valorActual, porcentaje, alcanzado };
}
