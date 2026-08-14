/**
 * Prueba del límite médico (§11.5).
 *
 * Vive fuera de src/ para que el build de Next.js no la compile, y se ejecuta
 * con `npm run prueba:limite`.
 *
 * Los casos NO son inventados: salen de la conversación real analizada en el
 * anexo C. Probar el límite con frases escritas por mí tendría el sesgo de
 * escribir justo lo que la lista ya detecta — de hecho, contrastar con las
 * reales encontró un fallo a la primera ("me ha dolido" no saltaba teniendo
 * "duele" y "dolor" en la lista, porque el verbo cambia de raíz).
 *
 * Al añadir términos o patrones, añade aquí el caso real que lo motivó.
 */

import {
  detectarSenalesMedicas,
  mensajeLimiteMedico,
} from "../src/lib/ia/limite-medico.ts";

/** Mensajes reales del usuario que DEBEN activar el límite. */
const DEBE_SALTAR: [texto: string, motivo: string][] = [
  ["Me duele la parte alta de la barriga como por debajo del diafragma", "síntoma"],
  ["La boca del estómago me ha dolido cuando he llegado a casa de entrenar", "síntoma en participio"],
  ["Me duelen las rodillas al bajar", "síntoma en plural"],
  ["Mañana llevaré 14 dias sin fumar tabaco, la verdad es que estoy bastante ansioso", "deshabituación"],
  ["Cambia algo que le haya pegado unas caladas a un vape?", "nicotina"],
  ["estoy en el dia 8 sin fumar", "deshabituación"],
  ["Me ha dicho mi médico que tome vitamina c y d y zinc para que sirven", "indicación médica"],
  ["Toma L-thyroxin 25", "medicación"],
  ["Tengo hígado graso diagnosticado", "condición diagnosticada"],
  ["Probable apnea del sueño según el médico", "condición diagnosticada"],
  ["Se me ha inflamado el codo después del press", "síntoma conjugado"],
];

/** Mensajes reales que NO deben activarlo: son registro o entrenamiento. */
const NO_DEBE_SALTAR: string[] = [
  "Hoy peso 116.9",
  "Cuánto tenemos que comer de arroz en una comida?",
  "Cuánto he perdido?",
  "Press de Piernas Serie 1: 130 kg x 12 Serie 2: 190 kg x 12",
  "Me gustaría empezar con entrenamientos por grupo para la semana siguiente",
  "Cuántas calorías estoy comiendo?",
  "Siento aqui si que empiezo a trabajar. La ultima de 12 ya me ha costado",
  "Hagamos 5 ejercicios porfa",
  "Cintura ombligo 124.5 Cintura estrecha 112 Glúteo 115.5",
  "200 kg fácil. 55 me costaba pero estabilidad",
];

let fallos = 0;

console.log("Debe activar el límite médico:");
for (const [texto, motivo] of DEBE_SALTAR) {
  const senales = detectarSenalesMedicas(texto);
  const ok = senales.length > 0;
  if (!ok) fallos++;
  const etiqueta = senales.map((s) => s.categoria).join(", ") || "(ninguna)";
  console.log(`  ${ok ? "✓" : "✗ FALLO"}  [${motivo}] ${etiqueta}`);
}

console.log("\nNo debe activarlo (registro y entrenamiento normales):");
for (const texto of NO_DEBE_SALTAR) {
  const senales = detectarSenalesMedicas(texto);
  const ok = senales.length === 0;
  if (!ok) fallos++;
  const etiqueta = senales.map((s) => s.termino).join(", ");
  console.log(`  ${ok ? "✓" : `✗ FALSO POSITIVO (${etiqueta})`}  "${texto.slice(0, 50)}"`);
}

console.log("\nEjemplo de respuesta cuando salta:");
console.log(
  mensajeLimiteMedico(detectarSenalesMedicas(DEBE_SALTAR[0][0]))
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n"),
);

if (fallos > 0) {
  console.error(`\n${fallos} fallo(s).`);
  process.exit(1);
}
console.log(
  `\nCorrecto: ${DEBE_SALTAR.length + NO_DEBE_SALTAR.length} casos, 0 fallos.`,
);
