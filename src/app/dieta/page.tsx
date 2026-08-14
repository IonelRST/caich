import { CheckinComida, FormularioComidaPlan } from "./formularios";
import { DIAS, diaSemanaHoy } from "@/lib/datos/dieta";
import { quitarComidaDelPlan } from "@/lib/datos/dieta-acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Dieta · caich" };

export default async function Dieta() {
  const supabase = await crearClienteServidor();
  const hoy = diaSemanaHoy();

  const { data: plan } = await supabase
    .from("plantilla")
    .select("id")
    .eq("tipo", "plan_dieta")
    .eq("activa", true)
    .limit(1)
    .maybeSingle();

  const { data: items } = plan
    ? await supabase
        .from("plantilla_item")
        .select("id, dia_semana, momento_dia, descripcion, cantidad, calorias, proteina_g, orden")
        .eq("plantilla_id", plan.id)
        .order("dia_semana")
        .order("orden")
    : { data: null };

  // Comidas ya registradas hoy, para no pedir dos veces el mismo check-in.
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const { data: registradasHoy } = await supabase
    .from("registro_comida")
    .select("plantilla_item_id")
    .gte("fecha_evento", inicioHoy.toISOString());

  const yaHechas = new Set(
    (registradasHoy ?? []).map((r) => r.plantilla_item_id).filter(Boolean),
  );

  const deHoy = (items ?? []).filter((i) => i.dia_semana === hoy);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dieta</h1>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium">
          Hoy · {DIAS[hoy - 1]}
        </h2>

        {deHoy.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            No hay comidas planificadas para hoy. Añádelas al plan más abajo.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {deHoy.map((i) => (
              <CheckinComida
                key={i.id}
                itemId={i.id}
                descripcion={i.descripcion ?? ""}
                cantidad={i.cantidad}
                momento={i.momento_dia}
                yaRegistrada={yaHechas.has(i.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Plan semanal</h2>
        <p className="mt-1 text-sm text-suave">
          Se define una vez, con calma. El día a día es solo confirmar.
        </p>

        {!items || items.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            El plan está vacío.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {DIAS.map((dia, idx) => {
              const delDia = items.filter((i) => i.dia_semana === idx + 1);
              if (delDia.length === 0) return null;

              return (
                <div key={dia}>
                  <h3 className="text-xs font-medium text-suave">
                    {dia}
                  </h3>
                  <ul className="mt-1 divide-y divide-borde">
                    {delDia.map((i) => (
                      <li
                        key={i.id}
                        className="flex items-center justify-between gap-4 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="text-suave">
                              {i.momento_dia}:
                            </span>{" "}
                            {i.descripcion}
                          </p>
                          <p className="text-xs text-suave">
                            {i.cantidad}
                            {i.calorias != null && ` · ${i.calorias} kcal`}
                            {i.proteina_g != null && ` · ${i.proteina_g} g prot.`}
                          </p>
                        </div>
                        <form action={quitarComidaDelPlan}>
                          <input type="hidden" name="id" value={i.id} />
                          <button
                            type="submit"
                            className="shrink-0 rounded-lg px-2 py-1 text-xs text-suave hover:text-error"
                          >
                            Quitar
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Añadir comida al plan</h2>
        <FormularioComidaPlan diaActual={hoy} />
      </section>
    </main>
  );
}
