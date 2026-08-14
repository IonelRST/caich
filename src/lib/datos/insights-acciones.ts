"use server";

import { calcularNivel1, type FilaComida, type FilaEntreno, type FilaMedida, type Nivel1 } from "./insights";
import {
  generarNivel23,
  type Nivel23,
  type PrincipioAprobado,
} from "@/lib/ia/insights-ia";
import { crearClienteServidor } from "@/lib/supabase/server";

export type LecturaInsights = {
  nivel1: Nivel1;
  principiosAprobados: number;
  error?: string;
};

type FilaEntrenoCruda = {
  fecha_evento: string;
  registro_entreno_ejercicio: {
    catalogo_ejercicio: { grupo_muscular: string | null } | null;
    registro_entreno_serie: { peso: number | null; repeticiones: number | null }[];
  }[];
};

/** Ventana de lectura: 60 días cubre la comparación de 30 y la de 7 vs 7 previos. */
const DIAS_LECTURA = 60;

async function leerDatos() {
  const supabase = await crearClienteServidor();
  const desde = new Date(Date.now() - DIAS_LECTURA * 86_400_000).toISOString();

  const [medidas, entrenos, comidas, principios] = await Promise.all([
    supabase
      .from("registro_medida")
      .select("nombre, valor, fecha_evento")
      .gte("fecha_evento", desde),
    supabase
      .from("registro_entreno")
      .select(
        "fecha_evento, registro_entreno_ejercicio(catalogo_ejercicio(grupo_muscular), registro_entreno_serie(peso, repeticiones))",
      )
      .gte("fecha_evento", desde),
    supabase
      .from("registro_comida")
      .select("fecha_evento, proteina_g, calorias, adherencia")
      .gte("fecha_evento", desde),
    supabase
      .from("principio_base")
      .select("id, enunciado, ambito")
      .eq("aprobado", true)
      .order("orden"),
  ]);

  // La forma anidada de Supabase se aplana aquí para que el módulo de cálculo
  // siga siendo puro y no sepa nada de cómo se leyeron los datos.
  //
  // El doble aserto es la convención que ya usan historial y entreno: para una
  // relación a-uno Supabase infiere un array, pero en ejecución llega un objeto.
  const entrenosPlanos: FilaEntreno[] = (
    (entrenos.data ?? []) as unknown as FilaEntrenoCruda[]
  ).map((e) => ({
    fecha_evento: e.fecha_evento,
    ejercicios: e.registro_entreno_ejercicio.map((ej) => ({
      grupo_muscular: ej.catalogo_ejercicio?.grupo_muscular ?? null,
      series: ej.registro_entreno_serie,
    })),
  }));

  return {
    medidas: (medidas.data ?? []) as FilaMedida[],
    entrenos: entrenosPlanos,
    comidas: (comidas.data ?? []) as FilaComida[],
    principios: (principios.data ?? []) as PrincipioAprobado[],
  };
}

/** Nivel 1: aritmética pura, sin IA y sin coste (§11.1). Se calcula siempre. */
export async function leerNivel1(): Promise<LecturaInsights> {
  const { medidas, entrenos, comidas, principios } = await leerDatos();

  return {
    nivel1: calcularNivel1(medidas, entrenos, comidas, Date.now()),
    principiosAprobados: principios.length,
  };
}

export type EstadoNivel23 = { resultado?: Nivel23; error?: string };

/**
 * Niveles 2 y 3: bajo demanda (§11.5), nunca al cargar la página.
 *
 * Es la única parte de los insights que cuesta una llamada a la API, así que se
 * dispara con un botón en vez de en cada visita.
 */
export async function pedirNivel23(): Promise<EstadoNivel23> {
  const { medidas, entrenos, comidas, principios } = await leerDatos();
  const nivel1 = calcularNivel1(medidas, entrenos, comidas, Date.now());

  try {
    return { resultado: await generarNivel23(principios, nivel1.estadisticas) };
  } catch (fallo) {
    return {
      error:
        fallo instanceof Error
          ? `No se han podido generar los insights: ${fallo.message}`
          : "No se han podido generar los insights.",
    };
  }
}
