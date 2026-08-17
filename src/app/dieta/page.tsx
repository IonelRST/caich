import { Biblioteca, FormularioComida } from "./biblioteca";
import { CheckinComida, FormularioComidaPlan } from "./formularios";
import { DIAS, diaSemanaHoy } from "@/lib/datos/dieta";
import type { ComidaGuardada } from "@/lib/datos/biblioteca-acciones";
import { quitarComidaDelPlan } from "@/lib/datos/dieta-acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata = { title: "Dieta · caich" };

export default async function Dieta() {
  const supabase = await crearClienteServidor();
  const hoy = diaSemanaHoy();

  // §6.1: el orden sale del uso, para que lo de siempre quede arriba sin
  // buscarlo. Lo hace la base de datos, no el componente.
  const { data: biblioteca } = await supabase
    .from("comida_guardada")
    .select("id, nombre, cantidad, calorias, proteina_g, veces_registrada, ultima_vez")
    .order("ultima_vez", { ascending: false, nullsFirst: false })
    .order("veces_registrada", { ascending: false });

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
        .select(
          "id, dia_semana, momento_dia, descripcion, cantidad, calorias, proteina_g, orden, comida_guardada(nombre, cantidad, calorias, proteina_g)",
        )
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

  // §6.4: un item enlazado a la biblioteca lee de ella; los antiguos conservan
  // sus propios campos, para que un plan de antes siga funcionando.
  type ItemPlan = (typeof items extends (infer T)[] | null ? T : never) & {
    comida_guardada?: {
      nombre: string;
      cantidad: string;
      calorias: number | null;
      proteina_g: number | null;
    } | null;
  };

  const resuelto = (i: ItemPlan) => {
    const enlazada = i.comida_guardada as unknown as {
      nombre: string;
      cantidad: string;
      calorias: number | null;
      proteina_g: number | null;
    } | null;
    return enlazada
      ? {
          descripcion: enlazada.nombre,
          cantidad: enlazada.cantidad,
          calorias: enlazada.calorias,
          proteina_g: enlazada.proteina_g,
        }
      : {
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          calorias: i.calorias,
          proteina_g: i.proteina_g,
        };
  };

  const deHoy = ((items ?? []) as ItemPlan[]).filter((i) => i.dia_semana === hoy);

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dieta</h1>
      </header>

      {/*
        §6.2: cuando hay plan para hoy, sus comidas van arriba. Cuando no lo
        hay, ese sitio lo ocupa la biblioteca. La pantalla nunca queda vacía por
        no haber planificado, que era el problema de la versión anterior.
      */}
      {deHoy.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium">
            Del plan de hoy · {DIAS[hoy - 1]}
          </h2>
          <ul className="mt-4 space-y-3">
            {deHoy.map((i) => (
              <CheckinComida
                key={i.id}
                itemId={i.id}
                descripcion={resuelto(i).descripcion ?? ""}
                cantidad={resuelto(i).cantidad}
                momento={i.momento_dia}
                yaRegistrada={yaHechas.has(i.id)}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium">Tu biblioteca</h2>
        <p className="mt-1 text-sm text-suave">
          Lo que repites. Un toque para registrarlo, sin plan de por medio.
        </p>

        <Biblioteca comidas={(biblioteca ?? []) as ComidaGuardada[]} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Guardar una comida</h2>
        <div className="mt-4">
          <FormularioComida />
        </div>
      </section>

      <section className="mt-10 border-t border-borde pt-6">
        <h2 className="text-sm font-medium">Plan semanal</h2>
        <p className="mt-1 text-sm text-suave">
          Opcional (§6.4). Coloca comidas en días concretos para medir
          adherencia. Sin plan, la biblioteca de arriba funciona igual.
        </p>

        {!items || items.length === 0 ? (
          <p className="mt-4 text-sm text-suave">
            El plan está vacío.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {DIAS.map((dia, idx) => {
              const delDia = (items as ItemPlan[]).filter(
                (i) => i.dia_semana === idx + 1,
              );
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
                            {resuelto(i).descripcion}
                          </p>
                          <p className="text-xs text-suave">
                            {resuelto(i).cantidad}
                            {resuelto(i).calorias != null &&
                              ` · ${resuelto(i).calorias} kcal`}
                            {resuelto(i).proteina_g != null &&
                              ` · ${resuelto(i).proteina_g} g prot.`}
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
        <FormularioComidaPlan
          diaActual={hoy}
          biblioteca={(biblioteca ?? []).map((c) => ({
            id: c.id,
            nombre: c.nombre,
          }))}
        />
      </section>
    </main>
  );
}
