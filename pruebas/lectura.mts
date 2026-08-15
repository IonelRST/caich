/**
 * Prueba del motor de devolución (§23) con la serie de pesos REAL del anexo C.
 *
 * Es el caso difícil a propósito: el peso corporal sube y baja a diario por
 * agua e intestino —el propio usuario señaló que se pesa "antes de cagar"— y
 * aun así la tendencia de fondo es descendente. Un motor que llame "subiendo"
 * a la serie porque dos días consecutivos subieron sería inútil.
 *
 * Se ejecuta con `npm run prueba:lectura`.
 */

import {
  calcularTendencia,
  fraseDeMedida,
  leerMedida,
  type PuntoMedida,
} from "../src/lib/devolucion/lectura.ts";

/** Pesos reales del usuario, en orden cronológico (anexo C). */
const PESOS: [fecha: string, valor: number][] = [
  ["2026-07-10", 122.3],
  ["2026-07-14", 119.7],
  ["2026-07-15", 118.9],
  ["2026-07-19", 120.1],
  ["2026-07-22", 118.9],
  ["2026-07-23", 118.1],
  ["2026-07-24", 118.4],
  ["2026-07-26", 117.2],
  ["2026-07-27", 116.9],
  ["2026-07-29", 118.4],
  ["2026-08-01", 118.2],
  ["2026-08-04", 118.8],
  ["2026-08-05", 119.1],
  ["2026-08-06", 118.5],
  ["2026-08-07", 118.2],
  ["2026-08-08", 118.0],
  ["2026-08-10", 117.0],
  ["2026-08-11", 116.9],
  ["2026-08-13", 117.1],
];

const puntos: PuntoMedida[] = PESOS.map(([fecha, valor]) => ({ fecha, valor }));

let fallos = 0;
function comprobar(descripcion: string, condicion: boolean, detalle: string) {
  if (!condicion) fallos++;
  console.log(`  ${condicion ? "✓" : "✗ FALLO"}  ${descripcion}: ${detalle}`);
}

console.log("Serie real de pesos (19 registros, 122,3 → 117,1):");

const bloque = leerMedida("peso", "kg", puntos, {
  descripcion: "llegar a 90 kg",
  valor: 90,
  unidad: "kg",
  direccion: "bajar",
});

if (!bloque) {
  console.error("La lectura devolvió null con datos.");
  process.exit(1);
}

comprobar("valor actual", bloque.valor === 117.1, `${bloque.valor} kg`);
comprobar(
  "cambio desde el inicio",
  bloque.desdeInicio === -5.2,
  `${bloque.desdeInicio} kg`,
);
comprobar(
  "tendencia pese a las oscilaciones diarias",
  bloque.tendencia === "bajando",
  bloque.tendencia,
);
comprobar(
  "no da el objetivo por alcanzado",
  bloque.objetivo?.alcanzado === false,
  `faltan ${bloque.objetivo?.restante} kg`,
);

console.log("\nSubconjuntos de la misma serie:");

// Los tres primeros días bajan en picado (agua y glucógeno). No es tendencia.
comprobar(
  "3 registros no bastan para hablar de tendencia",
  calcularTendencia(puntos.slice(0, 3)) === "insuficiente",
  calcularTendencia(puntos.slice(0, 3)),
);

// Del 29 jul al 8 ago el peso sube y vuelve a bajar: eso es una meseta.
const meseta = puntos.slice(9, 16);
comprobar(
  "una meseta no se llama 'bajando'",
  calcularTendencia(meseta) !== "bajando",
  `${calcularTendencia(meseta)} (${meseta.length} registros)`,
);

console.log("\nFrase que acompaña al bloque (§23.3):");
const frase = fraseDeMedida(bloque);
console.log(`  "${frase}"`);
comprobar(
  "la frase cita un número concreto, no ánimo genérico",
  frase !== null && /\d/.test(frase),
  frase ?? "(ninguna)",
);

// La regla de la §11.7: si diría lo mismo con datos peores, sobra.
const bloqueSubiendo = leerMedida(
  "peso",
  "kg",
  puntos.map((p, i) => ({ ...p, valor: 117 + i * 0.4 })),
  { descripcion: "llegar a 90 kg", valor: 90, unidad: "kg", direccion: "bajar" },
);
const fraseSubiendo = bloqueSubiendo ? fraseDeMedida(bloqueSubiendo) : null;
console.log(`  con datos al alza: "${fraseSubiendo}"`);
comprobar(
  "con datos peores la frase cambia (no es ánimo genérico)",
  fraseSubiendo !== frase,
  "distinta",
);

console.log("\nCerca del objetivo, el mensaje cambia solo (§23.4):");
for (const [etiqueta, valor] of [
  ["lejos", 117.1],
  ["a 2,5 kg", 92.5],
  ["a 600 g", 90.6],
] as [string, number][]) {
  const b = leerMedida(
    "peso",
    "kg",
    [...puntos.slice(0, -1), { fecha: "2026-08-13", valor }],
    { descripcion: "llegar a 90 kg", valor: 90, unidad: "kg", direccion: "bajar" },
  );
  console.log(`  ${etiqueta.padEnd(9)} → "${b ? fraseDeMedida(b) : "—"}"`);
}

if (fallos > 0) {
  console.error(`\n${fallos} fallo(s).`);
  process.exit(1);
}
console.log("\nCorrecto: 0 fallos.");
