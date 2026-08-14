import { z } from "zod";

/**
 * Forma exacta que debe tener la salida del parseo (§3.1: "JSON validado contra
 * un schema fijo por tipo de dato").
 *
 * La validación es estricta a propósito. La IA es la entrada, nunca la fuente de
 * verdad (§7.1): si devuelve un peso negativo o una fecha inventada, tiene que
 * caer aquí y no en la base de datos. Los topes replican los CHECK del esquema
 * SQL, para fallar con un mensaje legible en vez de con un error de Postgres.
 */

const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Fecha en formato incorrecto" });

const medida = z.object({
  nombre: z.string().min(1).max(60),
  valor: z.number().positive().max(1000),
  unidad: z.string().min(1).max(10),
  fecha: fechaISO,
});

const comida = z.object({
  descripcion: z.string().min(1).max(500),
  momento_dia: z.string().max(40).nullable(),
  cantidad: z.string().max(120).nullable(),
  calorias: z.number().min(0).max(20000).nullable(),
  proteina_g: z.number().min(0).max(2000).nullable(),
  carbohidratos_g: z.number().min(0).max(2000).nullable(),
  grasas_g: z.number().min(0).max(2000).nullable(),
  // §4.2: distinguir estimado de declarado impide que los insights traten una
  // estimación con la precisión de un dato dado por el usuario.
  origen_dato: z.enum(["declarado", "estimado"]),
  fecha: fechaISO,
});

const serie = z.object({
  peso: z.number().min(0).max(1000).nullable(),
  repeticiones: z.number().int().min(0).max(200).nullable(),
});

const ejercicio = z.object({
  // Nombre tal como lo escribió el usuario. La resolución contra el catálogo se
  // hace en el servidor (§4.1), no se le confía a la IA.
  nombre: z.string().min(1).max(120),
  series: z.array(serie).min(1).max(50),
});

const entreno = z.object({
  fecha: fechaISO,
  notas: z.string().max(500).nullable(),
  ejercicios: z.array(ejercicio).min(1).max(30),
});

export const esquemaParseo = z.object({
  medidas: z.array(medida).max(20),
  comidas: z.array(comida).max(20),
  entrenos: z.array(entreno).max(5),
  /**
   * Lo que la IA no ha podido estructurar, en forma de pregunta al usuario
   * (§3.1 y §7.4). Es la pieza que evita el peor comportamiento posible:
   * guardar dos de tres cosas y callarse.
   */
  dudas: z.array(z.string().min(1).max(300)).max(10),
});

export type Parseo = z.infer<typeof esquemaParseo>;
export type EntrenoParseado = z.infer<typeof entreno>;
export type ComidaParseada = z.infer<typeof comida>;
export type MedidaParseada = z.infer<typeof medida>;
