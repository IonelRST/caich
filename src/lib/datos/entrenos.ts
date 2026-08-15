/**
 * Tipos de rutinas y sesiones de entreno.
 *
 * Separado de entrenos-acciones.ts porque un archivo "use server" solo puede
 * exportar funciones async.
 */

export type Ejercicio = {
  id: string;
  nombre_canonico: string;
  grupo_muscular: string | null;
  equipo: string | null;
};

/** §5.1. 'descendente' no arranca el temporizador de la serie siguiente. */
export type TipoSerie = "normal" | "calentamiento" | "fallo" | "descendente";

export const TIPOS_SERIE: { valor: TipoSerie; etiqueta: string; sigla: string }[] = [
  { valor: "normal", etiqueta: "Normal", sigla: "" },
  { valor: "calentamiento", etiqueta: "Calentamiento", sigla: "C" },
  { valor: "fallo", etiqueta: "Al fallo", sigla: "F" },
  { valor: "descendente", etiqueta: "Descendente", sigla: "D" },
];

/** Una serie planificada dentro de un ejercicio de rutina (§5.1). */
export type SerieRutina = {
  id: string;
  numero_serie: number;
  tipo: TipoSerie;
  peso_objetivo: number | null;
  /** reps_max null = objetivo fijo (reps_min); si no, es el rango min..max. */
  reps_min: number | null;
  reps_max: number | null;
};

export type ItemRutina = {
  id: string;
  orden: number;
  ejercicio_id: string;
  nota: string | null;
  /** null = temporizador desactivado para este ejercicio (§5.1). */
  descanso_segundos: number | null;
  /** Los items de una rutina con el mismo valor no nulo van juntos (§5.1). */
  superset_grupo: number | null;
  series: SerieRutina[];
  ejercicio: Ejercicio;
};

export type Rutina = {
  id: string;
  nombre: string;
  items: ItemRutina[];
};

/**
 * Una serie de una sesión en vivo (§5.2).
 *
 * A diferencia del modelo anterior, la fila existe desde que arranca la
 * sesión: se crea copiada del plan y `completada` dice si ya se hizo. Antes
 * la fila solo nacía al confirmar, así que existir equivalía a estar hecha.
 */
export type SerieRegistrada = {
  id: string;
  numero_serie: number;
  tipo: TipoSerie;
  peso: number | null;
  repeticiones: number | null;
  completada: boolean;
  peso_objetivo: number | null;
  reps_min: number | null;
  reps_max: number | null;
};

/**
 * Lo que se hizo en esta misma serie la vez anterior (§5.2).
 *
 * La referencia es por índice de serie, no un único valor por ejercicio: la
 * serie 3 de hoy enseña la serie 3 de la última vez. Si aquel día hubo menos
 * series, no hay referencia y la celda queda vacía.
 */
export type SerieAnterior = {
  peso: number | null;
  repeticiones: number | null;
};

export function volumenDeSerie(peso: number | null, reps: number | null) {
  return (peso ?? 0) * (reps ?? 0);
}

/**
 * Etiqueta de la columna SERIE, siguiendo el criterio de la referencia.
 *
 * El calentamiento no se numera: se marca con "C" y no gasta número, de modo
 * que las series de trabajo van 1, 2, 3 tanto si hay calentamiento delante
 * como si no. Las de fallo y descendente sí llevan número, con su letra al
 * lado — son series de trabajo y saber por cuál vas importa.
 *
 * Numerar todo del 1 al N y luego tapar algunos números con letras daba
 * "C, 2, 3, D": ni la cuenta de la referencia ni ninguna otra.
 */
export function etiquetasDeSerie(
  tipos: TipoSerie[],
): { numero: string; sigla: string }[] {
  let trabajo = 0;
  return tipos.map((tipo) => {
    if (tipo === "calentamiento") return { numero: "", sigla: "C" };
    trabajo++;
    const sigla = TIPOS_SERIE.find((t) => t.valor === tipo)?.sigla ?? "";
    return { numero: String(trabajo), sigla };
  });
}

/** Formatea el objetivo de una serie: "8" si es fijo, "6-8" si es rango. */
export function textoObjetivoReps(
  repsMin: number | null,
  repsMax: number | null,
): string {
  if (repsMin == null) return "";
  return repsMax == null || repsMax === repsMin
    ? String(repsMin)
    : `${repsMin}-${repsMax}`;
}

/**
 * Color de un superset (§21.5).
 *
 * Reutiliza la paleta categórica de series de datos, en orden. No hay
 * conflicto de vocabularios porque un superset y un gráfico no coinciden
 * nunca en pantalla. El color nunca es el único canal: la interfaz añade
 * corchete lateral y etiqueta (§21.9).
 */
export const COLORES_SUPERSET = [
  "#2563EB",
  "#7C3AED",
  "#0891B2",
  "#DB2777",
  "#475569",
] as const;

export function colorSuperset(grupo: number): string {
  return COLORES_SUPERSET[(grupo - 1) % COLORES_SUPERSET.length];
}

/** Letra del superset: A, B, C… Acompaña siempre al color (§21.9). */
export function etiquetaSuperset(grupo: number): string {
  return String.fromCharCode(65 + ((grupo - 1) % 26));
}

/**
 * Una sesión se desvió de su rutina si cambió la forma del plan: ejercicios o
 * número de series. Cambiar el peso o las reps de una serie no cuenta como
 * desvío — es justo lo que se espera que pase en cada entreno.
 *
 * Es lo que decide si al cerrar se pregunta por actualizar la plantilla (§5.3).
 */
export function sesionSeDesvio(
  plan: { ejercicioId: string; series: number }[],
  hecho: { ejercicioId: string; series: number }[],
): boolean {
  if (plan.length !== hecho.length) return true;
  return plan.some(
    (p, i) =>
      hecho[i].ejercicioId !== p.ejercicioId || hecho[i].series !== p.series,
  );
}
