import Link from "next/link";
import { FormularioMedida } from "./formulario-medida";
import { cerrarSesion } from "./login/acciones";
import { etiquetaDeMedida } from "@/lib/datos/medidas";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

export default async function Portada() {
  // El proxy ya redirige a /login si no hay sesión; aquí el usuario existe.
  const usuario = await usuarioActual();
  const supabase = await crearClienteServidor();

  const [{ data: ultimas }, { data: enCurso }] = await Promise.all([
    supabase
      .from("registro_medida")
      .select("id, nombre, valor, unidad, fecha_evento")
      .order("fecha_evento", { ascending: false })
      .limit(5),
    // §5.3: una sesión sin terminar se puede retomar. Si no se mostrara aquí,
    // un entreno interrumpido quedaría enterrado y se daría por perdido.
    supabase
      .from("registro_entreno")
      .select("id, fecha_evento")
      .eq("completado", false)
      .order("fecha_evento", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* La marca ya está en la barra lateral; repetirla aquí no aporta. */}
          <h1 className="text-2xl font-semibold tracking-tight">Hoy</h1>
          <p className="mt-1 text-sm text-suave">{usuario?.email}</p>
        </div>

        <form action={cerrarSesion}>
          <button
            type="submit"
            className="control rounded-lg px-3 py-1.5 text-sm"
          >
            Salir
          </button>
        </form>
      </header>

      {enCurso && (
        <Link
          href={`/entreno/${enCurso.id}`}
          className="mt-8 flex items-center justify-between gap-4 rounded-xl bg-accion px-5 py-4 text-sobre-accion"
        >
          <span className="text-sm font-medium">Tienes un entreno en curso</span>
          <span className="text-sm">Retomar →</span>
        </Link>
      )}

      <Link
        href="/chat"
        className="control mt-8 flex items-center justify-between gap-4 rounded-xl px-5 py-4 hover:border-accion"
      >
        <span className="text-sm font-medium">
          Registrar escribiendo
          <span className="mt-0.5 block font-normal text-suave">
            Peso, comida o entreno en lenguaje normal
          </span>
        </span>
        <span className="text-sm text-suave">→</span>
      </Link>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Registrar una medida</h2>
        <div className="mt-4">
          <FormularioMedida />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Últimos registros</h2>

        {!ultimas || ultimas.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            Nada registrado todavía. Guarda tu primera medida arriba.
          </p>
        ) : (
          <ul className="alzado mt-4 divide-y divide-borde rounded-xl px-4">
            {ultimas.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <span className="text-sm">{etiquetaDeMedida(r.nombre)}</span>
                <span className="flex items-baseline gap-3">
                  {/* §21.6: cifras con tabular-nums, obligatorio para que los
                      valores se alineen en columna. */}
                  <span className="tabular-nums">
                    {r.valor}{" "}
                    <span className="text-sm text-suave">{r.unidad}</span>
                  </span>
                  <span className="w-16 text-right text-xs text-suave tabular-nums">
                    {formatoFecha.format(new Date(r.fecha_evento))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-borde pt-6">
        <h2 className="text-sm font-medium">Tus datos</h2>
        <p className="mt-2 text-sm text-suave">
          Son datos de salud personales. Puedes descargarlos cuando quieras, sin
          depender de que esta app siga existiendo.
        </p>
        <div className="mt-3 flex gap-4">
          <a
            href="/api/exportar?formato=json"
            className="text-sm underline underline-offset-4"
          >
            Descargar todo (JSON)
          </a>
          <a
            href="/api/exportar?formato=csv"
            className="text-sm underline underline-offset-4"
          >
            Medidas (CSV)
          </a>
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-dashed border-borde p-5">
        <h2 className="text-sm font-medium">Pendiente</h2>
        <p className="mt-2 text-sm text-suave">
          Falta el dictado por voz (§3.4), los resúmenes automáticos periódicos
          (§11.5) y la capa MCP (§12).
        </p>
      </section>
    </main>
  );
}
