/**
 * Motor de la devolución (§23).
 *
 * Calcula la lectura del estado a partir de los datos estructurados. Es
 * aritmética pura del nivel 1 (§11.2): no llama al modelo, no interpreta y no
 * afirma causas. Las dos superficies de la §23.1 —la devolución inmediata tras
 * registrar y el panel de estado— comparten este mismo motor; la primera es
 * este cálculo aplicado a lo que se acaba de meter.
 *
 * Que esto viva en código y no en un prompt es deliberado: "has bajado 5,4 kg"
 * no debe depender de que un modelo sume bien.
 */

export type PuntoMedida = { fecha: string; valor: number };

export type Tendencia = "bajando" | "subiendo" | "estable" | "insuficiente";

export type BloqueMedida = {
  nombre: string;
  valor: number;
  unidad: string;
  /** Cambio frente al primer registro. null si solo hay uno. */
  desdeInicio: number | null;
  /** Cambio frente al registro inmediatamente anterior. */
  desdeAnterior: number | null;
  tendencia: Tendencia;
  /** Días que cubre el histórico de esta medida. */
  diasDeHistorico: number;
  objetivo: ProgresoObjetivo | null;
};

export type ProgresoObjetivo = {
  descripcion: string;
  valorObjetivo: number;
  unidad: string;
  /** Lo que falta, en valor absoluto. 0 si ya se alcanzó. */
  restante: number;
  alcanzado: boolean;
  /** 0-100, medido desde el primer valor registrado. */
  porcentaje: number;
};

/** Redondea a un decimal: los pesos corporales no necesitan más precisión. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Formatea un número para leerlo en español: coma decimal, sin decimal cuando
 * es entero. Los números van a texto que lee una persona, y "5.2 kg" en una
 * app en español se lee como un error de programador.
 */
export function num(n: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
}

function diasEntre(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Tendencia sobre los últimos puntos.
 *
 * Compara la media de la primera mitad con la de la segunda en vez de mirar
 * solo el último valor: el peso corporal oscila a diario por agua e intestino
 * —el usuario lo señaló él mismo al pesarse "antes y después de cagar"— y un
 * único dato bajo o alto no es una tendencia.
 */
export function calcularTendencia(puntos: PuntoMedida[]): Tendencia {
  if (puntos.length < 4) return "insuficiente";

  const mitad = Math.floor(puntos.length / 2);
  const media = (xs: PuntoMedida[]) =>
    xs.reduce((s, p) => s + p.valor, 0) / xs.length;

  const primera = media(puntos.slice(0, mitad));
  const segunda = media(puntos.slice(mitad));
  const delta = segunda - primera;

  // Umbral proporcional: 0,5 % del valor medio. Por debajo es ruido.
  const umbral = Math.abs(primera) * 0.005;
  if (Math.abs(delta) < umbral) return "estable";
  return delta < 0 ? "bajando" : "subiendo";
}

export function calcularProgreso(
  actual: number,
  inicial: number,
  objetivo: { descripcion: string; valor: number; unidad: string; direccion: "subir" | "bajar" },
): ProgresoObjetivo {
  const alcanzado =
    objetivo.direccion === "bajar"
      ? actual <= objetivo.valor
      : actual >= objetivo.valor;

  const recorridoTotal = Math.abs(objetivo.valor - inicial);
  const recorrido = Math.abs(actual - inicial);

  return {
    descripcion: objetivo.descripcion,
    valorObjetivo: objetivo.valor,
    unidad: objetivo.unidad,
    restante: alcanzado ? 0 : r1(Math.abs(objetivo.valor - actual)),
    alcanzado,
    porcentaje: alcanzado
      ? 100
      : recorridoTotal === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round((recorrido / recorridoTotal) * 100))),
  };
}

/**
 * Lectura de una medida corporal. `puntos` viene en orden cronológico
 * ascendente y el último es el más reciente.
 */
export function leerMedida(
  nombre: string,
  unidad: string,
  puntos: PuntoMedida[],
  objetivo?: { descripcion: string; valor: number; unidad: string; direccion: "subir" | "bajar" },
): BloqueMedida | null {
  if (puntos.length === 0) return null;

  const ultimo = puntos[puntos.length - 1];
  const primero = puntos[0];
  const anterior = puntos.length > 1 ? puntos[puntos.length - 2] : null;

  return {
    nombre,
    valor: ultimo.valor,
    unidad,
    desdeInicio: puntos.length > 1 ? r1(ultimo.valor - primero.valor) : null,
    desdeAnterior: anterior ? r1(ultimo.valor - anterior.valor) : null,
    tendencia: calcularTendencia(puntos),
    diasDeHistorico: diasEntre(primero.fecha, ultimo.fecha),
    objetivo: objetivo
      ? calcularProgreso(ultimo.valor, primero.valor, objetivo)
      : null,
  };
}

/**
 * Frase corta que acompaña al bloque (§23.3 y §23.4).
 *
 * Regla de la §11.7 aplicada literalmente: **si diría lo mismo con datos
 * peores, sobra.** Por eso cada rama depende de un número concreto y devuelve
 * null cuando no hay nada que añadir. Animar sí, celebrar el registro no: el
 * texto se vuelve más cercano porque el dato cambió, no porque hayas apuntado.
 */
export function fraseDeMedida(bloque: BloqueMedida): string | null {
  const { objetivo, tendencia, desdeInicio, diasDeHistorico, unidad } = bloque;

  if (objetivo?.alcanzado) {
    return `Objetivo alcanzado: ${objetivo.descripcion}.`;
  }

  // Cerca del objetivo: el mensaje cambia porque la distancia cambió.
  if (objetivo && objetivo.restante > 0 && objetivo.restante <= 1) {
    return `Te queda menos de ${objetivo.unidad === "kg" ? "1 kg" : `1 ${objetivo.unidad}`} para ${objetivo.descripcion}.`;
  }
  if (objetivo && objetivo.restante <= 3) {
    return `Te faltan ${num(objetivo.restante)} ${objetivo.unidad} para ${objetivo.descripcion}.`;
  }

  // Tendencia sostenida: solo si hay histórico suficiente para llamarlo así.
  if (tendencia === "bajando" && diasDeHistorico >= 14 && desdeInicio !== null) {
    return `Llevas ${diasDeHistorico} días bajando de forma sostenida: ${num(Math.abs(desdeInicio))} ${unidad} en total.`;
  }
  if (tendencia === "subiendo" && diasDeHistorico >= 14 && desdeInicio !== null) {
    return `La tendencia de las últimas semanas es al alza: ${desdeInicio > 0 ? "+" : ""}${num(desdeInicio)} ${unidad}.`;
  }

  // Un solo dato no da para nada, y decirlo es más honesto que inventar ánimo.
  if (tendencia === "insuficiente") {
    return "Con pocos registros todavía no se puede hablar de tendencia.";
  }

  return null;
}
