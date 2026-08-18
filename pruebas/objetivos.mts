/**
 * Prueba del cálculo de progreso de objetivos (§9).
 *
 * Cubre el caso que falló en uso real: con el recorrido medido en valor
 * absoluto, alejarse del objetivo contaba igual que acercarse, y un objetivo de
 * bajar mostraba "100 % del recorrido" mientras el peso subía. Es un error que
 * no se ve —la cifra existe y parece razonable— y que dice al usuario lo
 * contrario de lo que pasa.
 *
 * Se ejecuta con `npm run prueba:objetivos`.
 */

import { calcularProgreso, type Objetivo } from "../src/lib/datos/objetivos.ts";

let fallos = 0;

function comprobar(descripcion: string, condicion: boolean, detalle: string) {
  if (condicion) {
    console.log(`  ✓  ${descripcion}: ${detalle}`);
  } else {
    fallos++;
    console.error(`  ✗  ${descripcion}: ${detalle}`);
  }
}

function objetivo(campos: Partial<Objetivo>): Objetivo {
  return {
    id: "x",
    descripcion: "prueba",
    metrica: "measurement:peso",
    valor_objetivo: 108,
    unidad: "kg",
    direccion: "bajar",
    fecha_objetivo: null,
    cumplido_en: null,
    ...campos,
  };
}

console.log("\nProgreso de objetivos (§9):");

const sinRecorridoPosible = calcularProgreso(objetivo({}), 116, 77.2);
comprobar(
  "si el punto de partida no deja recorrido en esa dirección, no hay porcentaje",
  sinRecorridoPosible.porcentaje === null,
  `bajar a 108 desde 77,2 estando en 116 → ${sinRecorridoPosible.porcentaje}`,
);

const alejandose = calcularProgreso(objetivo({}), 120, 116);
comprobar(
  "alejarse del objetivo no es progreso",
  alejandose.porcentaje === 0,
  `bajar a 108 desde 116 estando en 120 → ${alejandose.porcentaje} %`,
);
comprobar(
  "y tampoco está alcanzado",
  alejandose.alcanzado === false,
  String(alejandose.alcanzado),
);

const aMitad = calcularProgreso(objetivo({}), 112, 116);
comprobar(
  "medio camino en un objetivo de bajar",
  aMitad.porcentaje === 50,
  `bajar a 108 desde 116 estando en 112 → ${aMitad.porcentaje} %`,
);

const mitad = calcularProgreso(objetivo({}), 104, 100);
comprobar(
  "medio camino en un objetivo de subir",
  calcularProgreso(objetivo({ direccion: "subir", valor_objetivo: 120 }), 110, 100)
    .porcentaje === 50,
  `subir a 120 desde 100 estando en 110 → ${calcularProgreso(objetivo({ direccion: "subir", valor_objetivo: 120 }), 110, 100).porcentaje} %`,
);
comprobar(
  "pasarse del objetivo lo da por alcanzado",
  mitad.alcanzado === true && mitad.porcentaje === 100,
  `bajar a 108 estando en 104 → ${mitad.porcentaje} %`,
);

const objetivoIgualAlInicio = calcularProgreso(objetivo({ valor_objetivo: 100 }), 116, 100);
comprobar(
  "si el objetivo coincide con el punto de partida, no se da por hecho",
  objetivoIgualAlInicio.porcentaje === null && objetivoIgualAlInicio.alcanzado === false,
  `${objetivoIgualAlInicio.porcentaje}, alcanzado ${objetivoIgualAlInicio.alcanzado}`,
);

const sinDatos = calcularProgreso(objetivo({}), null, null);
comprobar(
  "sin ninguna medida no se inventa un porcentaje",
  sinDatos.porcentaje === null,
  String(sinDatos.porcentaje),
);

console.log(fallos === 0 ? "\nCorrecto: 0 fallos.\n" : `\n${fallos} fallo(s).\n`);
process.exit(fallos === 0 ? 0 : 1);
