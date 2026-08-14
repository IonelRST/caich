// Prueba manual y desechable del modelo DeepSeek-V4 Flash vía TensorX.
// Uso: node --env-file=.env.local scripts/probar-tensorx.mjs "tu prompt aquí"

const clave = process.env.TENSORX_API_KEY;
if (!clave) {
  console.error("Falta TENSORX_API_KEY (revisa .env.local)");
  process.exit(1);
}

const prompt = process.argv[2] ?? "Responde con una sola frase: ¿qué modelo eres?";

const respuesta = await fetch("https://api.tensorx.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${clave}`,
  },
  body: JSON.stringify({
    model: "deepseek/deepseek-v4-flash-0731",
    messages: [{ role: "user", content: prompt }],
  }),
});

if (!respuesta.ok) {
  console.error(`TensorX respondió ${respuesta.status}:`, await respuesta.text());
  process.exit(1);
}

const datos = await respuesta.json();
console.log(datos.choices[0].message.content);
