/**
 * Prueba de la lógica pura de rutinas 1:1 con Hevy (§5, §19 punto 6).
 *
 * Cubre las tres decisiones que no son "guardar un campo más" y que, si se
 * equivocan, lo hacen en silencio:
 *
 *   1. El objetivo de repeticiones, que es fijo o rango según un campo nulo.
 *   2. La detección de desvío, que decide si se ofrece reescribir la rutina
 *      del usuario. Un falso positivo molesta; un falso negativo pierde el
 *      cambio que acababa de hacer.
 *   3. El color de superset, que debe salir de la paleta de series (§21.5) y
 *      no tocar nunca el acento de acción (§21.4).
 *
 * Se ejecuta con `npm run prueba:rutinas`.
 */

import {
  COLORES_SUPERSET,
  colorSuperset,
  etiquetaSuperset,
  sesionSeDesvio,
  textoObjetivoReps,
} from "../src/lib/datos/entrenos.ts";

let fallos = 0;

function comprobar(descripcion: string, condicion: boolean, detalle: string) {
  if (condicion) {
    console.log(`  ✓  ${descripcion}: ${detalle}`);
  } else {
    fallos++;
    console.error(`  ✗  ${descripcion}: ${detalle}`);
  }
}

console.log("\nObjetivo de repeticiones (§5.1):");

comprobar(
  "sin tope es objetivo fijo",
  textoObjetivoReps(8, null) === "8",
  textoObjetivoReps(8, null),
);
comprobar(
  "con tope distinto es rango",
  textoObjetivoReps(6, 8) === "6-8",
  textoObjetivoReps(6, 8),
);
comprobar(
  "un tope igual al mínimo no se escribe como rango",
  textoObjetivoReps(8, 8) === "8",
  textoObjetivoReps(8, 8),
);
comprobar(
  "sin mínimo no hay objetivo que enseñar",
  textoObjetivoReps(null, 12) === "",
  `"${textoObjetivoReps(null, 12)}"`,
);

console.log("\nDesvío de la rutina (§5.3):");

const plan = [
  { ejercicioId: "sentadilla", series: 4 },
  { ejercicioId: "prensa", series: 3 },
];

comprobar(
  "hacer el plan tal cual no es desvío",
  sesionSeDesvio(plan, [
    { ejercicioId: "sentadilla", series: 4 },
    { ejercicioId: "prensa", series: 3 },
  ]) === false,
  "no se pregunta por actualizar la plantilla",
);

comprobar(
  "una serie de más sí es desvío",
  sesionSeDesvio(plan, [
    { ejercicioId: "sentadilla", series: 5 },
    { ejercicioId: "prensa", series: 3 },
  ]),
  "se ofrece actualizar",
);

comprobar(
  "un ejercicio añadido es desvío",
  sesionSeDesvio(plan, [
    { ejercicioId: "sentadilla", series: 4 },
    { ejercicioId: "prensa", series: 3 },
    { ejercicioId: "femoral", series: 3 },
  ]),
  "se ofrece actualizar",
);

comprobar(
  "un ejercicio saltado es desvío",
  sesionSeDesvio(plan, [{ ejercicioId: "sentadilla", series: 4 }]),
  "se ofrece actualizar",
);

comprobar(
  "reordenar los ejercicios es desvío",
  sesionSeDesvio(plan, [
    { ejercicioId: "prensa", series: 3 },
    { ejercicioId: "sentadilla", series: 4 },
  ]),
  "el orden de la rutina es parte del plan",
);

// Esta es la que de verdad importa: subir el peso es lo que se espera que
// pase en cada entreno. Si contara como desvío, la app preguntaría por
// reescribir la rutina absolutamente siempre, y la pregunta dejaría de
// significar nada a la tercera vez.
comprobar(
  "cambiar peso o reps NO es desvío",
  sesionSeDesvio(plan, [
    { ejercicioId: "sentadilla", series: 4 },
    { ejercicioId: "prensa", series: 3 },
  ]) === false,
  "solo cambia la forma del plan, no los números del día",
);

console.log("\nColor de superset (§21.4, §21.5):");

// §21.4: el acento pasó de naranja a teal el 16 de agosto de 2026.
const ACENTO = ["#0b6675", "#3fc3d8", "#45cfe4"];
const usados = [1, 2, 3, 4, 5, 6, 7].map(colorSuperset);

comprobar(
  "sale de la paleta de series",
  usados.every((c) => (COLORES_SUPERSET as readonly string[]).includes(c)),
  usados.slice(0, 5).join(" "),
);
comprobar(
  "nunca es el acento de acción",
  usados.every((c) => !ACENTO.includes(c.toLowerCase())),
  "el teal sigue queriendo decir '¿dónde toco?'",
);
comprobar(
  "da la vuelta al agotar la paleta",
  colorSuperset(6) === colorSuperset(1),
  `grupo 6 = grupo 1 = ${colorSuperset(6)}`,
);
comprobar(
  "la etiqueta acompaña siempre al color (§21.9)",
  etiquetaSuperset(1) === "A" && etiquetaSuperset(2) === "B",
  `${etiquetaSuperset(1)}, ${etiquetaSuperset(2)}`,
);

if (fallos > 0) {
  console.error(`\n${fallos} fallo(s).`);
  process.exit(1);
}
console.log("\nCorrecto: 0 fallos.");
