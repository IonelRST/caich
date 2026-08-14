import { esquemaParseo, type Parseo } from "./esquemas";
import { completar } from "./proveedor";

function promptSistema(catalogo: string[], hoy: string): string {
  return `Eres el parseador de una app de tracking fitness. Recibes un mensaje en lenguaje natural y devuelves ÚNICAMENTE un objeto JSON, sin texto alrededor ni bloques de código.

Forma exacta del JSON:
{
  "medidas":  [{ "nombre": string, "valor": number, "unidad": string, "fecha": "YYYY-MM-DD" }],
  "comidas":  [{ "descripcion": string, "momento_dia": string|null, "cantidad": string|null,
                 "calorias": number|null, "proteina_g": number|null,
                 "carbohidratos_g": number|null, "grasas_g": number|null,
                 "origen_dato": "declarado"|"estimado", "fecha": "YYYY-MM-DD" }],
  "entrenos": [{ "fecha": "YYYY-MM-DD", "notas": string|null,
                 "ejercicios": [{ "nombre": string,
                                  "series": [{ "peso": number|null, "repeticiones": number|null }] }] }],
  "dudas":    [string]
}

Reglas:

1. Un mismo mensaje puede contener varios tipos de dato a la vez. Sepáralos.
2. NUNCA inventes datos. Si falta información relevante para estructurar algo, no lo incluyas en su lista: añade una pregunta concreta a "dudas".
3. Guarda lo que sí entiendas aunque otra parte del mensaje falle. No rechaces el mensaje entero.
4. Hoy es ${hoy}. Si el mensaje no dice cuándo ocurrió algo, usa esa fecha. Si dice "ayer", "el lunes", "anteayer", calcula la fecha correspondiente.
5. Medidas: usa nombres en minúsculas y sin acentos: peso, grasa_corporal, cintura, pecho, brazo, pierna, cadera. Unidades: kg, lbs, %, cm, in.
6. Entrenos: "sentadilla 80kg 4x8" son 4 series de 8 repeticiones a 80 kg — expándelo a 4 objetos en "series". Si los pesos varían por serie ("80, 85, 90"), refléjalo serie a serie.
7. Comidas: estima calorías y macros a partir de la descripción. Si el usuario dio cantidades explícitas ("200g de pollo"), origen_dato es "declarado". Si has tenido que estimar también la cantidad, es "estimado".
8. Si una comida es tan vaga que no se puede estimar nada razonable ("comí algo", "picoteé"), NO la incluyas en "comidas": pregunta por ella en "dudas".
9. Si el mensaje no contiene ningún dato registrable, devuelve las tres listas vacías y explica en "dudas" qué falta.

Ejercicios ya conocidos en el catálogo (usa estos nombres si el mensaje se refiere a uno de ellos):
${catalogo.join(", ")}

Si el mensaje menciona un ejercicio que no está en esa lista, inclúyelo igualmente con el nombre que haya usado el usuario. La app se encarga de resolverlo.`;
}

/**
 * Extrae el objeto JSON de la respuesta del modelo.
 *
 * Aunque el prompt pide JSON pelado, los modelos lo envuelven en ```json con
 * cierta frecuencia, y un fallo de parseo aquí perdería un mensaje que la IA
 * había entendido bien. Se recorta al primer { y al último }.
 */
function extraerJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new Error("La respuesta del modelo no contenía un objeto JSON");
  }
  return JSON.parse(texto.slice(inicio, fin + 1));
}

export async function parsearMensaje(
  texto: string,
  catalogo: string[],
  hoy: string,
): Promise<Parseo> {
  const respuesta = await completar(promptSistema(catalogo, hoy), texto, "parseo");
  const validado = esquemaParseo.safeParse(extraerJson(respuesta));

  if (!validado.success) {
    // El modelo ha devuelto algo que no encaja con el esquema. Es un fallo del
    // parseo, no del usuario: no se guarda nada a medias (§7.1).
    throw new Error(
      `El parseo devolvió datos con forma inesperada: ${validado.error.issues[0].path.join(".")}`,
    );
  }

  return validado.data;
}
