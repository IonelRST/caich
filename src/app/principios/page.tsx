import { BotonGenerar, FormularioPrincipio } from "./formularios";
import {
  aprobarPrincipio,
  borrarPrincipio,
  retirarPrincipio,
} from "@/lib/datos/principios-acciones";
import { ETIQUETA_AMBITO, type Ambito } from "@/lib/ia/principios";
import { crearClienteServidor } from "@/lib/supabase/server";

type Principio = {
  id: string;
  enunciado: string;
  ambito: Ambito;
  aprobado: boolean;
};

export default async function Principios() {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("principio_base")
    .select("id, enunciado, ambito, aprobado")
    .order("orden");

  const principios = (data ?? []) as Principio[];
  const aprobados = principios.filter((p) => p.aprobado);
  const pendientes = principios.filter((p) => !p.aprobado);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Principios
        </h1>
        <p className="mt-2 text-sm text-suave">
          Es la base que autoriza a la app a relacionar unos datos con otros o a
          sugerir un cambio. Sin un principio aprobado detrás, un insight solo
          puede señalar la coincidencia, nunca afirmar la causa.
        </p>
      </header>

      {/*
        La migración 0003 puede no estar aplicada todavía. Sin este aviso la
        página aparecería vacía y parecería que no hay principios, cuando lo que
        falta es la tabla.
      */}
      {error && (
        <p
          role="alert"
          className="mt-8 rounded-xl border border-borde bg-superficie p-5 text-sm text-error"
        >
          No se ha podido leer la base de principios: {error.message}. Comprueba
          que la migración 0003 está aplicada en Supabase.
        </p>
      )}

      {!error && principios.length === 0 && (
        <section className="mt-8 space-y-4 rounded-xl border border-dashed border-borde p-5">
          <p className="text-sm text-suave">
            Todavía no hay ninguno. La IA puede redactar un borrador de 15-18
            principios básicos; tú decides cuáles valen. Se hace una vez.
          </p>
          <BotonGenerar />
        </section>
      )}

      {pendientes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-aviso">
            Sin revisar ({pendientes.length})
          </h2>
          <p className="mt-2 text-sm text-suave">
            Redactados por la IA pero no aprobados, así que todavía no se usan
            para nada.
          </p>

          <ul className="mt-4 space-y-3">
            {pendientes.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-borde bg-superficie p-4"
              >
                <p className="text-sm">{p.enunciado}</p>
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-xs text-suave">
                    {ETIQUETA_AMBITO[p.ambito]}
                  </span>
                  <form action={aprobarPrincipio}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-sm text-exito underline underline-offset-4"
                    >
                      Aprobar
                    </button>
                  </form>
                  <form action={borrarPrincipio}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-sm text-suave underline underline-offset-4"
                    >
                      Descartar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aprobados.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium">Aprobados ({aprobados.length})</h2>
          <ul className="mt-4 space-y-3">
            {aprobados.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-borde bg-superficie p-4"
              >
                <p className="text-sm">{p.enunciado}</p>
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-xs text-suave">
                    {ETIQUETA_AMBITO[p.ambito]}
                  </span>
                  <form action={retirarPrincipio}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-sm text-suave underline underline-offset-4"
                    >
                      Retirar
                    </button>
                  </form>
                  <form action={borrarPrincipio}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-sm text-suave underline underline-offset-4"
                    >
                      Borrar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!error && (
        <section className="mt-8">
          <FormularioPrincipio />
        </section>
      )}
    </main>
  );
}
