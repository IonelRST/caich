import { z } from "zod";
import type { Estadistica } from "@/lib/datos/insights";
import { completar } from "./proveedor";

/**
 * Insights de nivel 2 y 3 (§11.2, §11.3, §11.4).
 *
 * Lo que separa los dos niveles es el TIPO de afirmación, no si existe una fila
 * aprobada en una tabla: aplicar conocimiento establecido del dominio es nivel 2
 * y puede concluir; inferir un patrón del histórico propio es nivel 3 y solo
 * puede observar.
 *
 * La garantía del nivel 2 es que diga en qué se apoya (§11.3), y eso se
 * comprueba aquí: un nivel 2 sin apoyo escrito no se descarta en silencio, baja
 * a nivel 3, que es lo que la especificación prescribe para una afirmación que
 * no puede sostener su conclusión.
 *
 * La base de principios aprobados que antes hacía de puerta se retiró el 16 de
 * agosto de 2026 (§11.6): 18 redactados y 0 aprobados, así que no filtraba nada,
 * solo impedía emitir nivel 2.
 */

export type InsightNivel2 = {
  afirmacion: string;
  /** En qué se apoya el razonamiento (§11.3). Nunca vacío. */
  apoyo: string;
  datosDeRespaldo: string;
  muestras: number;
  fuerza: "debil" | "moderada" | "fuerte";
};

export type InsightNivel3 = {
  observacion: string;
  datosDeRespaldo: string;
  /** Cierto si venía como nivel 2 sin apoyo escrito y se ha degradado. */
  degradado: boolean;
};

export type Nivel23 = {
  nivel2: InsightNivel2[];
  nivel3: InsightNivel3[];
  /** Nota explícita cuando no hay histórico que interpretar (§11.7). */
  nota?: string;
};

const esquema = z.object({
  nivel2: z
    .array(
      z.object({
        afirmacion: z.string().min(10).max(600),
        apoyo: z.string().max(400),
        datos_de_respaldo: z.string().min(5).max(600),
        muestras: z.number().int().min(0).max(100000),
        fuerza: z.enum(["debil", "moderada", "fuerte"]),
      }),
    )
    .max(6),
  nivel3: z
    .array(
      z.object({
        observacion: z.string().min(10).max(600),
        datos_de_respaldo: z.string().min(5).max(600),
      }),
    )
    .max(6),
});

function sistema(): string {
  return `Eres el motor de insights de una app de tracking fitness personal. Recibes estadísticas ya calculadas sobre los datos reales del usuario y debes interpretarlas con reglas muy estrictas.

Devuelve ÚNICAMENTE un objeto JSON, sin texto alrededor ni bloques de código:
{
  "nivel2": [{ "afirmacion": string, "apoyo": string, "datos_de_respaldo": string,
               "muestras": number, "fuerza": "debil"|"moderada"|"fuerte" }],
  "nivel3": [{ "observacion": string, "datos_de_respaldo": string }]
}

REGLA CENTRAL: lo que decide el nivel es el TIPO de afirmación, no lo segura que te parezca.

- "nivel2" es aplicar conocimiento establecido de entrenamiento y nutrición a los datos del usuario. Aquí SÍ puedes concluir y recomendar. "apoyo" debe decir en qué se apoya el razonamiento, en una frase y con nombre propio (por ejemplo: sobrecarga progresiva, rango de proteína por kilo, déficit calórico, volumen mínimo efectivo). No basta con repetir la afirmación: el usuario tiene que poder discrepar del razonamiento, no solo del número.
- "nivel3" es inferir un patrón de los datos del propio usuario ("cuando haces X, te pasa Y"). Aquí NO puedes concluir ni recomendar: describe la coincidencia en bruto y nombra los confusores evidentes que no puedes descartar.

Ante la duda entre los dos, es nivel 3.

Más reglas:

1. "datos_de_respaldo" debe contener las cifras y fechas concretas de las estadísticas recibidas, para que el usuario pueda verificarlo. No vale repetir la conclusión.
2. "muestras" es cuántos registros sostienen el insight, tomado de las estadísticas recibidas.
3. "fuerza" es "debil" con pocos datos (menos de una semana o menos de 5 registros), "moderada" con datos de varias semanas, "fuerte" solo con un histórico amplio y consistente.
4. No inventes datos que no estén en las estadísticas recibidas. Si algo no aparece, no existe.
5. Nunca menciones enfermedades, lesiones, diagnósticos, medicación ni síntomas. Ante cualquier cosa de ese tipo, no interpretes: remite a un profesional (entrenador, nutricionista o médico).
6. Prefiere pocos insights buenos a muchos. Como máximo 4 de nivel 2 y 4 de nivel 3. Si los datos no dan para nada, devuelve las dos listas vacías.
7. Escribe en español, dirigiéndote al usuario en segunda persona, sin alarmismo.`;
}

function extraerJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new Error("La respuesta del modelo no contenía un objeto JSON");
  }
  return JSON.parse(texto.slice(inicio, fin + 1));
}

function describirEstadisticas(estadisticas: Estadistica[]): string {
  return estadisticas
    .map(
      (e) =>
        `- ${e.titulo}: ${e.valor}. ${e.detalle} (registros que lo sostienen: ${e.muestras})`,
    )
    .join("\n");
}

export async function generarNivel23(
  estadisticas: Estadistica[],
): Promise<Nivel23> {
  // §11.7: sin estadísticas no hay nada que interpretar, y forzar una lectura
  // sobre un histórico vacío es justo lo que la especificación prohíbe.
  if (estadisticas.length === 0) {
    return {
      nivel2: [],
      nivel3: [],
      nota: "Aún no hay suficiente historial para interpretar nada. Registra unos días más.",
    };
  }

  const respuesta = await completar(
    sistema(),
    `Estadísticas calculadas sobre los datos del usuario:\n${describirEstadisticas(estadisticas)}`,
    "insights",
  );

  const validado = esquema.safeParse(extraerJson(respuesta));
  if (!validado.success) {
    throw new Error(
      `Los insights vinieron con forma inesperada: ${validado.error.issues[0].path.join(".")}`,
    );
  }

  const nivel2: InsightNivel2[] = [];
  const nivel3: InsightNivel3[] = validado.data.nivel3.map((o) => ({
    observacion: o.observacion,
    datosDeRespaldo: o.datos_de_respaldo,
    degradado: false,
  }));

  for (const candidato of validado.data.nivel2) {
    const apoyo = candidato.apoyo.trim();

    // §11.3: la garantía del nivel 2 es decir en qué se apoya. Pedirlo en el
    // prompt no basta, así que se comprueba aquí. Sin apoyo escrito la
    // afirmación no puede sostenerse, pero tampoco se tira: baja a nivel 3.
    if (apoyo.length === 0) {
      nivel3.push({
        observacion: candidato.afirmacion,
        datosDeRespaldo: candidato.datos_de_respaldo,
        degradado: true,
      });
      continue;
    }

    nivel2.push({
      afirmacion: candidato.afirmacion,
      apoyo,
      datosDeRespaldo: candidato.datos_de_respaldo,
      muestras: candidato.muestras,
      fuerza: candidato.fuerza,
    });
  }

  return { nivel2, nivel3 };
}
