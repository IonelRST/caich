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

  /*
   * El recorrido se mide EN LA DIRECCIÓN DECLARADA, no en valor absoluto.
   *
   * Midiéndolo en absoluto, alejarse del objetivo contaba igual que acercarse:
   * un objetivo de bajar a 108 kg, con la medida más antigua en 77,2 y la
   * actual en 116, daba "100 % del recorrido" mientras el peso subía.
   *
   * Y cuando el punto de partida no deja recorrido en esa dirección —aquí, 108
   * está por encima de 77,2 y el objetivo era bajar— no hay porcentaje que
   * signifique nada. Se devuelve null y la interfaz no pinta barra, en vez de
   * inventar una cifra tranquilizadora.
   */
  const necesario =
    objetivo.direccion === "bajar"
      ? inicial - objetivo.valor_objetivo
      : objetivo.valor_objetivo - inicial;

  const avance =
    objetivo.direccion === "bajar" ? inicial - valorActual : valorActual - inicial;

  const porcentaje = alcanzado
    ? 100
    : necesario <= 0
      ? null
      : Math.max(0, Math.min(100, Math.round((avance / necesario) * 100)));

  return { objetivo, valorActual, porcentaje, alcanzado };
}
