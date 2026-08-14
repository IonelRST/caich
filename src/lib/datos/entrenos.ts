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

export type ItemRutina = {
  id: string;
  orden: number;
  ejercicio_id: string;
  series_objetivo: number | null;
  reps_objetivo: number | null;
  peso_objetivo: number | null;
  ejercicio: Ejercicio;
};

export type Rutina = {
  id: string;
  nombre: string;
  items: ItemRutina[];
};

export type SerieRegistrada = {
  numero_serie: number;
  peso: number | null;
  repeticiones: number | null;
};

/** Lo que se hizo la vez anterior en un ejercicio, para mostrarlo de referencia. */
export type SerieAnterior = {
  peso: number | null;
  repeticiones: number | null;
};

export function volumenDeSerie(peso: number | null, reps: number | null) {
  return (peso ?? 0) * (reps ?? 0);
}
