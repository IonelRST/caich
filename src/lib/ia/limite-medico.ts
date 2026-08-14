/**
 * Límite médico (§11.5). La app no interpreta síntomas, condiciones
 * diagnosticadas, medicación ni deshabituación tabáquica: los registra y remite
 * a un profesional.
 *
 * Esta capa es DETERMINISTA a propósito, y va antes que cualquier llamada al
 * modelo. Un clasificador por IA puede equivocarse, derivar entre versiones del
 * modelo o dejarse arrastrar por el propio texto que está clasificando. El
 * límite de la §11.5 no puede depender de eso: es la misma lógica por la que
 * RLS vive en la base de datos y no solo en la capa MCP (§12.1).
 *
 * Es deliberadamente conservador. Un falso positivo cuesta que la app diga
 * "esto lo registro pero no lo interpreto"; un falso negativo cuesta que opine
 * sobre un síntoma real. El coste no es simétrico.
 */

type Categoria = "sintoma" | "condicion" | "medicacion" | "adiccion";

type Senal = { categoria: Categoria; termino: string };

/**
 * Términos que disparan el límite. Se comparan sobre texto normalizado (sin
 * tildes, en minúsculas) y con frontera de palabra, para que "dolor" no salte
 * dentro de otra palabra pero sí en "me duele".
 *
 * No pretende ser exhaustivo — ninguna lista lo es. Es el suelo por debajo del
 * cual el sistema no puede bajar, no el techo de lo que detecta: el clasificador
 * del modelo (§11.5) corre después y puede marcar más cosas.
 */
const TERMINOS: Record<Categoria, string[]> = {
  sintoma: [
    "dolor", "duele", "duelen", "molestia", "molestias", "mareo", "mareos",
    "nausea", "nauseas", "vomito", "vomitos", "fiebre", "sangre", "sangrado",
    "hinchazon", "inflamacion", "pinchazo", "pinchazos", "ardor", "acidez",
    "palpitaciones", "taquicardia", "desmayo", "vision borrosa", "entumecido",
    "hormigueo", "diarrea", "estreñimiento", "insomnio", "ahogo", "asfixia",
  ],
  condicion: [
    "higado graso", "esteatosis", "apnea", "cpap", "hipotiroidismo", "tiroides",
    "diabetes", "hipertension", "colesterol", "anemia", "hernia", "lesion",
    "tendinitis", "artrosis", "diagnostico", "diagnosticado", "analitica",
    "analisis de sangre", "resonancia", "radiografia", "ecografia",
    "medico", "doctora", "doctor", "traumatologo", "fisio", "fisioterapeuta",
  ],
  medicacion: [
    "medicamento", "medicacion", "pastilla", "pastillas", "receta", "dosis",
    "antibiotico", "ibuprofeno", "paracetamol", "omeprazol", "thyroxin",
    "levotiroxina", "metformina", "estatina", "estatinas", "ansiolitico",
    "antidepresivo",
  ],
  adiccion: [
    "fumar", "fumo", "fumando", "fumado", "tabaco", "cigarro", "cigarrillo",
    "nicotina", "vape", "vapear", "abstinencia", "recaida", "mono",
    "dejar de fumar", "alcohol", "borrachera",
  ],
};

/**
 * Familias de palabras que no se pueden enumerar como términos sueltos porque
 * el verbo cambia de raíz al conjugarse: doler → duele, dolió, dolido, dolía.
 * Probar con una lista de formas fijas deja huecos — se detectó exactamente eso
 * al contrastar con mensajes reales ("me ha dolido" no saltaba teniendo
 * "duele" y "dolor" en la lista).
 */
const PATRONES: Record<Categoria, RegExp[]> = {
  sintoma: [
    // doler / dolor / dolido / dolía  +  duele / duelen / duela
    /(^|[^a-z0-9])(dol|duel)[a-z]*/,
    // molesta / molestia / molestaba
    /(^|[^a-z0-9])molest[a-z]*/,
    // marea / mareado / mareo
    /(^|[^a-z0-9])marea[a-z]*/,
    // inflama / inflamado / hincha / hinchado
    /(^|[^a-z0-9])(inflam|hinch)[a-z]*/,
  ],
  condicion: [
    // lesion / lesionado / lesionarse
    /(^|[^a-z0-9])lesion[a-z]*/,
    // diagnostico / diagnosticado / diagnosticar
    /(^|[^a-z0-9])diagnostic[a-z]*/,
  ],
  medicacion: [
    // medicamento / medicacion / medicarse / medicado
    /(^|[^a-z0-9])medica[a-z]*/,
  ],
  adiccion: [
    // fumar / fumo / fumado / fumando / fumador
    /(^|[^a-z0-9])fum[a-z]*/,
    // vape / vapear / vapeando
    /(^|[^a-z0-9])vape[a-z]*/,
  ],
};

/** Quita tildes y baja a minúsculas, para comparar sin depender de cómo se escriba. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Escapa un término para meterlo en una expresión regular sin sorpresas. */
function escapar(termino: string): string {
  return termino.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Devuelve las señales médicas encontradas en el texto. Vacío = no hay señal
 * determinista; no significa que el mensaje sea seguro, solo que esta capa no
 * lo ha marcado.
 */
export function detectarSenalesMedicas(texto: string): Senal[] {
  const normalizado = normalizar(texto);
  const encontradas: Senal[] = [];

  for (const [categoria, terminos] of Object.entries(TERMINOS) as [
    Categoria,
    string[],
  ][]) {
    let marcada = false;

    for (const termino of terminos) {
      // Frontera de palabra en ambos extremos: "mono" no debe saltar dentro de
      // "monotonia", pero sí en "tengo mono".
      const patron = new RegExp(
        `(^|[^a-z0-9])${escapar(normalizar(termino))}([^a-z0-9]|$)`,
      );
      if (patron.test(normalizado)) {
        encontradas.push({ categoria, termino });
        marcada = true;
        break; // una señal por categoría basta para disparar el límite
      }
    }

    if (marcada) continue;

    for (const patron of PATRONES[categoria]) {
      const coincidencia = normalizado.match(patron);
      if (coincidencia) {
        encontradas.push({ categoria, termino: coincidencia[0].trim() });
        break;
      }
    }
  }

  return encontradas;
}

export function tieneSenalMedica(texto: string): boolean {
  return detectarSenalesMedicas(texto).length > 0;
}

const RESPUESTA_POR_CATEGORIA: Record<Categoria, string> = {
  sintoma:
    "Has mencionado un síntoma. Lo dejo registrado para que puedas llevarlo a tu médico, pero no voy a interpretarlo ni a decirte si es importante.",
  condicion:
    "Has mencionado una condición diagnosticada o una prueba médica. Queda registrado, pero su interpretación y su seguimiento son de tu médico, no de esta app.",
  medicacion:
    "Has mencionado medicación. No opino sobre dosis, interacciones ni suplementación con efecto clínico: eso es de tu médico o tu farmacéutico.",
  adiccion:
    "Has mencionado tabaco o consumo. Lo registro si quieres llevar la cuenta, pero el acompañamiento de una deshabituación no es algo que deba llevar una app de entrenamiento.",
};

/**
 * Mensaje que sustituye a cualquier interpretación cuando salta el límite.
 * Registra, no opina y no tranquiliza (§11.5).
 */
export function mensajeLimiteMedico(senales: Senal[]): string {
  const categorias = [...new Set(senales.map((s) => s.categoria))];
  const cuerpo = categorias.map((c) => RESPUESTA_POR_CATEGORIA[c]).join(" ");

  return `${cuerpo}\n\nSi te preocupa, consúltalo con un profesional. Puedo seguir ayudándote con el entrenamiento y el registro.`;
}
