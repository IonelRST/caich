import { z } from "zod";
import type { Estadistica } from "@/lib/datos/insights";
import { completar } from "./proveedor";

/**
 * Insights de nivel 2 y 3 (§11.2, §11.3).
 *
 * La regla de §11.2 es que la IA solo puede afirmar una relación causal o
 * recomendar un cambio si conecta con un principio de la base curada, y lo dice.
 *
 * Pedirlo en el prompt no basta: un modelo puede citar un principio que no
 * existe, o inventarse el identificador. Por eso la comprobación está aquí, en
 * código, contra los ids realmente aprobados. Lo que no supere el filtro no se
 * descarta en silencio: baja a nivel 3, que es exactamente lo que la
 * especificación prescribe para lo que no encaja con ningún principio.
 */

export type PrincipioAprobado = {
  id: string;
  enunciado: string;
  ambito: string;
};

export type InsightNivel2 = {
  afirmacion: string;
  principio: PrincipioAprobado;
  datosDeRespaldo: string;
  muestras: number;
  fuerza: "debil" | "moderada" | "fuerte";
};

export type InsightNivel3 = {
  observacion: string;
  datosDeRespaldo: string;
  /** Cierto si venía como nivel 2 sin principio válido y se ha degradado. */
  degradado: boolean;
};

export type Nivel23 = {
  nivel2: InsightNivel2[];
  nivel3: InsightNivel3[];
  /** Nota explícita cuando no hay base para nada (§11.6). */
  nota?: string;
};

const esquema = z.object({
  nivel2: z
    .array(
      z.object({
        afirmacion: z.string().min(10).max(600),
        principio_id: z.string().min(1),
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

function sistema(principios: PrincipioAprobado[]): string {
  const listado =
    principios.length === 0
      ? "(ninguno: el usuario no ha aprobado todavía ningún principio)"
      : principios
          .map((p) => `- id ${p.id} · [${p.ambito}] ${p.enunciado}`)
          .join("\n");

  return `Eres el motor de insights de una app de tracking fitness personal. Recibes estadísticas ya calculadas sobre los datos reales del usuario y debes interpretarlas con reglas muy estrictas.

Devuelve ÚNICAMENTE un objeto JSON, sin texto alrededor ni bloques de código:
{
  "nivel2": [{ "afirmacion": string, "principio_id": string, "datos_de_respaldo": string,
               "muestras": number, "fuerza": "debil"|"moderada"|"fuerte" }],
  "nivel3": [{ "observacion": string, "datos_de_respaldo": string }]
}

REGLA CENTRAL: solo puedes afirmar que algo influye en algo, o sugerir un cambio, si eso se apoya en uno de los principios aprobados de la lista de abajo. En ese caso va en "nivel2" y "principio_id" debe ser EXACTAMENTE uno de los ids listados. No inventes ids ni cites principios que no estén en la lista.

Si observas algo que no encaja con ningún principio de la lista, va en "nivel3": describe la coincidencia en bruto, SIN afirmar causa y SIN recomendar nada.

Más reglas:

1. "datos_de_respaldo" debe contener las cifras y fechas concretas de las estadísticas recibidas, para que el usuario pueda verificarlo. No vale repetir la conclusión.
2. "muestras" es cuántos registros sostienen el insight, tomado de las estadísticas recibidas.
3. "fuerza" es "debil" con pocos datos (menos de una semana o menos de 5 registros), "moderada" con datos de varias semanas, "fuerte" solo con un histórico amplio y consistente.
4. No inventes datos que no estén en las estadísticas recibidas. Si algo no aparece, no existe.
5. Nunca menciones enfermedades, lesiones ni diagnósticos. Para cualquier cosa que se salga de los principios de la lista, remite a un profesional (entrenador, nutricionista o médico) desde el nivel 3.
6. Prefiere pocos insights buenos a muchos. Como máximo 4 de nivel 2 y 4 de nivel 3. Si los datos no dan para nada, devuelve las dos listas vacías.
7. Escribe en español, dirigiéndote al usuario en segunda persona, sin alarmismo.

Principios aprobados:
${listado}`;
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
  principios: PrincipioAprobado[],
  estadisticas: Estadistica[],
): Promise<Nivel23> {
  // §11.6: sin estadísticas no hay nada que interpretar, y forzar una lectura
  // sobre un histórico vacío es justo lo que la especificación prohíbe.
  if (estadisticas.length === 0) {
    return {
      nivel2: [],
      nivel3: [],
      nota: "Aún no hay suficiente historial para interpretar nada. Registra unos días más.",
    };
  }

  const respuesta = await completar(
    sistema(principios),
    `Estadísticas calculadas sobre los datos del usuario:\n${describirEstadisticas(estadisticas)}`,
    "insights",
  );

  const validado = esquema.safeParse(extraerJson(respuesta));
  if (!validado.success) {
    throw new Error(
      `Los insights vinieron con forma inesperada: ${validado.error.issues[0].path.join(".")}`,
    );
  }

  const porId = new Map(principios.map((p) => [p.id, p]));

  const nivel2: InsightNivel2[] = [];
  const nivel3: InsightNivel3[] = validado.data.nivel3.map((o) => ({
    observacion: o.observacion,
    datosDeRespaldo: o.datos_de_respaldo,
    degradado: false,
  }));

  for (const candidato of validado.data.nivel2) {
    const principio = porId.get(candidato.principio_id);

    if (!principio) {
      // Afirmaba causalidad sin ancla válida. No se tira: se queda como
      // observación sin conclusión, que es lo que permite §11.3.
      nivel3.push({
        observacion: candidato.afirmacion,
        datosDeRespaldo: candidato.datos_de_respaldo,
        degradado: true,
      });
      continue;
    }

    nivel2.push({
      afirmacion: candidato.afirmacion,
      principio,
      datosDeRespaldo: candidato.datos_de_respaldo,
      muestras: candidato.muestras,
      fuerza: candidato.fuerza,
    });
  }

  return { nivel2, nivel3 };
}
