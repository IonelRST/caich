import Link from "next/link";
import { Nivel23 } from "./lectura";
import { leerNivel1 } from "@/lib/datos/insights-acciones";

export default async function Insights() {
  const { nivel1, principiosAprobados } = await leerNivel1();

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="mt-2 text-sm text-suave">
          Los números de abajo son aritmética sobre tus registros, sin IA de por
          medio. La lectura interpretada va aparte, y solo puede afirmar una causa
          si se apoya en un principio que hayas aprobado.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Estadísticas</h2>

        {nivel1.estadisticas.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            Todavía no hay datos suficientes para calcular nada.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {nivel1.estadisticas.map((e) => (
              <li
                key={e.clave}
                className="rounded-xl border border-borde bg-superficie p-4"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-sm">{e.titulo}</h3>
                  <span className="font-cifra text-xl tabular-nums">
                    {e.valor}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-suave">{e.detalle}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* §11.6: lo que no se puede calcular se dice, en vez de omitirlo y dar la
          impresión de que el histórico está completo. */}
      {nivel1.insuficiente.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-suave">Todavía sin base</h2>
          <ul className="mt-3 space-y-1.5">
            {nivel1.insuficiente.map((nota, i) => (
              <li key={i} className="text-sm text-suave">
                {nota}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 border-t border-borde pt-6">
        <h2 className="text-sm font-medium">Lectura interpretada</h2>
        <p className="mt-2 text-sm text-suave">
          Cuesta una llamada a la IA, así que se pide a mano.{" "}
          {principiosAprobados > 0 ? (
            <>
              Tienes {principiosAprobados} principios aprobados como ancla.{" "}
              <Link
                href="/principios"
                className="underline underline-offset-4"
              >
                Revisarlos
              </Link>
              .
            </>
          ) : (
            <>
              No tienes principios aprobados todavía.{" "}
              <Link
                href="/principios"
                className="underline underline-offset-4"
              >
                Aprobar algunos
              </Link>
              .
            </>
          )}
        </p>

        <div className="mt-5">
          <Nivel23 hayPrincipios={principiosAprobados > 0} />
        </div>
      </section>
    </main>
  );
}
