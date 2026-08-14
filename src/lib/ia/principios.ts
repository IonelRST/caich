import { z } from "zod";
import { completar } from "./proveedor";

/**
 * Generación del borrador de la base curada de principios (§11.4).
 *
 * La IA redacta, el usuario aprueba. Ese orden es el punto de la sección: revisar
 * una lista pequeña y estable una sola vez no se parece en nada a confiar en que
 * el modelo razone en caliente sobre la salud del usuario en cada consulta.
 */

export const AMBITOS = ["entrenamiento", "nutricion", "recuperacion"] as const;

export type Ambito = (typeof AMBITOS)[number];

export const ETIQUETA_AMBITO: Record<Ambito, string> = {
  entrenamiento: "Entrenamiento",
  nutricion: "Nutrición",
  recuperacion: "Recuperación",
};

const esquemaBorrador = z.object({
  principios: z
    .array(
      z.object({
        enunciado: z.string().min(20).max(400),
        ambito: z.enum(AMBITOS),
      }),
    )
    .min(12)
    .max(20),
});

export type PrincipioBorrador = z.infer<
  typeof esquemaBorrador
>["principios"][number];

const SISTEMA = `Eres un asistente que redacta una lista corta de principios de entrenamiento y nutrición para una app de tracking fitness personal.

Devuelve ÚNICAMENTE un objeto JSON, sin texto alrededor ni bloques de código:
{ "principios": [{ "enunciado": string, "ambito": "entrenamiento"|"nutricion"|"recuperacion" }] }

Requisitos:

1. Entre 15 y 18 principios. Ni uno más: esto es una base curada, no una enciclopedia.
2. SOLO principios bien establecidos y no controvertidos, del tipo que cualquier profesional suscribiría. Nada de temas debatidos, modas, protocolos de nicho ni suplementación.
3. Cubre obligatoriamente: sobrecarga progresiva, rangos de proteína para hipertrofia, papel del sueño en la recuperación, déficit y superávit calórico para el cambio de peso, volumen mínimo efectivo, y gestión de la fatiga con descargas (deloads).
4. Cada enunciado debe ser una frase autocontenida y accionable, con rangos numéricos cuando el consenso los tenga (ej. gramos de proteína por kilo de peso corporal, horas de sueño).
5. Escribe en español, en tono neutro y sin imperativos dirigidos al usuario.
6. No incluyas nada que dependa de datos concretos de una persona: son principios generales, no consejos personalizados.
7. No menciones enfermedades, lesiones ni tratamientos médicos.`;

function extraerJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new Error("La respuesta del modelo no contenía un objeto JSON");
  }
  return JSON.parse(texto.slice(inicio, fin + 1));
}

export async function generarBorradorPrincipios(): Promise<
  PrincipioBorrador[]
> {
  const respuesta = await completar(
    SISTEMA,
    "Redacta la base curada de principios.",
  );

  const validado = esquemaBorrador.safeParse(extraerJson(respuesta));
  if (!validado.success) {
    throw new Error(
      `El borrador vino con forma inesperada: ${validado.error.issues[0].path.join(".")}`,
    );
  }

  return validado.data.principios;
}
