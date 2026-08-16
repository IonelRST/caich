/**
 * Única puerta de salida hacia un modelo de lenguaje.
 *
 * La especificación (§12) asume la API de Claude, y sigue siendo el destino:
 * el tool calling de la Fase 3 se apoya en ella. Pero durante el desarrollo el
 * parseo se ejecuta muchas veces sobre los mismos mensajes de prueba, y pagar
 * eso a precio de Claude no aporta nada. TensorX da acceso a DeepSeek-V4 Flash
 * mucho más barato, con endpoint compatible con OpenAI.
 *
 * De ahí el conmutador: no es una capa de abstracción de proveedores, es un
 * interruptor de desarrollo. Se elige con IA_PROVEEDOR, y si no está puesta gana
 * TensorX cuando hay clave suya, porque es el caso de prueba.
 *
 * ATENCIÓN (§14): TensorX es un tercero ajeno a Anthropic. Estos mensajes son
 * datos de salud. Para uso real, IA_PROVEEDOR=claude.
 */

type Proveedor = "tensorx" | "claude";

/**
 * §15: modelo según tarea. El parseo es simple y repetitivo y se ejecuta en
 * cada mensaje, así que va a un modelo rápido y barato; los insights razonan
 * sobre varias semanas de histórico a la vez, así que se reservan el modelo
 * capaz. Un único modelo para ambas cosas paga de más en la
 * tarea frecuente o rinde de menos en la difícil.
 */
export type Tarea = "parseo" | "insights";

const MODELOS_CLAUDE: Record<Tarea, string> = {
  parseo: "claude-haiku-4-5",
  insights: "claude-opus-5",
};

/** TensorX es el interruptor de desarrollo: un solo modelo barato para todo. */
const MODELO_TENSORX = "deepseek/deepseek-v4-flash-0731";

function proveedorActivo(): Proveedor {
  const elegido = process.env.IA_PROVEEDOR;
  if (elegido === "tensorx" || elegido === "claude") return elegido;
  return process.env.TENSORX_API_KEY ? "tensorx" : "claude";
}

export function modeloEnUso(tarea: Tarea): string {
  return proveedorActivo() === "tensorx"
    ? MODELO_TENSORX
    : MODELOS_CLAUDE[tarea];
}

/**
 * Pide una respuesta al modelo. `sistema` fija las reglas, `usuario` es el texto
 * a procesar. Devuelve el texto crudo: quien llama valida (§7.1).
 */
export async function completar(
  sistema: string,
  usuario: string,
  tarea: Tarea,
): Promise<string> {
  return proveedorActivo() === "tensorx"
    ? completarTensorx(sistema, usuario)
    : completarClaude(sistema, usuario, tarea);
}

async function completarTensorx(
  sistema: string,
  usuario: string,
): Promise<string> {
  const clave = process.env.TENSORX_API_KEY;
  if (!clave) throw new Error("Falta TENSORX_API_KEY en el entorno");

  const respuesta = await fetch("https://api.tensorx.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${clave}`,
    },
    body: JSON.stringify({
      model: MODELO_TENSORX,
      messages: [
        { role: "system", content: sistema },
        { role: "user", content: usuario },
      ],
      // Parseo, no redacción: se quiere el mismo texto interpretado igual dos
      // veces, no variedad.
      temperature: 0,
    }),
  });

  if (!respuesta.ok) {
    throw new Error(
      `TensorX respondió ${respuesta.status}: ${await respuesta.text()}`,
    );
  }

  const datos = await respuesta.json();
  const texto = datos?.choices?.[0]?.message?.content;
  if (typeof texto !== "string") {
    throw new Error("TensorX devolvió una respuesta sin texto");
  }
  return texto;
}

async function completarClaude(
  sistema: string,
  usuario: string,
  tarea: Tarea,
): Promise<string> {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) throw new Error("Falta ANTHROPIC_API_KEY en el entorno");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const cliente = new Anthropic({ apiKey: clave });

  const esParseo = tarea === "parseo";

  const respuesta = await cliente.messages.create({
    model: MODELOS_CLAUDE[tarea],
    // En los modelos con razonamiento, max_tokens limita pensamiento Y
    // respuesta juntos: si se ajusta al tamaño del JSON esperado, la respuesta
    // se corta a media frase. De ahí el margen en insights.
    max_tokens: esParseo ? 2048 : 8192,
    system: sistema,
    messages: [{ role: "user", content: usuario }],
    // temperature SOLO en el modelo de parseo. Los modelos Opus actuales
    // rechazan temperature/top_p/top_k con un 400: enviarlo aquí rompería los
    // insights en cuanto se cambie el proveedor a Claude.
    ...(esParseo ? { temperature: 0 } : {}),
  });

  const bloque = respuesta.content.find((c) => c.type === "text");
  if (!bloque || bloque.type !== "text") {
    throw new Error("Claude devolvió una respuesta sin texto");
  }
  return bloque.text;
}
