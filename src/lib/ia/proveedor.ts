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

const MODELOS: Record<Proveedor, string> = {
  tensorx: "deepseek/deepseek-v4-flash-0731",
  claude: "claude-sonnet-4-5",
};

function proveedorActivo(): Proveedor {
  const elegido = process.env.IA_PROVEEDOR;
  if (elegido === "tensorx" || elegido === "claude") return elegido;
  return process.env.TENSORX_API_KEY ? "tensorx" : "claude";
}

export function modeloEnUso(): string {
  return MODELOS[proveedorActivo()];
}

/**
 * Pide una respuesta al modelo. `sistema` fija las reglas, `usuario` es el texto
 * a procesar. Devuelve el texto crudo: quien llama valida (§7.1).
 */
export async function completar(
  sistema: string,
  usuario: string,
): Promise<string> {
  return proveedorActivo() === "tensorx"
    ? completarTensorx(sistema, usuario)
    : completarClaude(sistema, usuario);
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
      model: MODELOS.tensorx,
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
): Promise<string> {
  const clave = process.env.ANTHROPIC_API_KEY;
  if (!clave) throw new Error("Falta ANTHROPIC_API_KEY en el entorno");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const cliente = new Anthropic({ apiKey: clave });

  const respuesta = await cliente.messages.create({
    model: MODELOS.claude,
    max_tokens: 2048,
    temperature: 0,
    system: sistema,
    messages: [{ role: "user", content: usuario }],
  });

  const bloque = respuesta.content.find((c) => c.type === "text");
  if (!bloque || bloque.type !== "text") {
    throw new Error("Claude devolvió una respuesta sin texto");
  }
  return bloque.text;
}
