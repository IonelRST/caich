"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  borrarComida,
  guardarComida,
  registrarComida,
  type ComidaGuardada,
  type EstadoBiblioteca,
} from "@/lib/datos/biblioteca-acciones";

const INICIAL: EstadoBiblioteca = {};

const claseCampo =
  "hundido w-full rounded-lg px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40";

function Boton({ texto, cargando }: { texto: string; cargando: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accion px-4 py-2 text-sm font-medium text-sobre-accion shadow-apoyado disabled:opacity-50"
    >
      {pending ? cargando : texto}
    </button>
  );
}

function BotonRegistrar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="control h-11 shrink-0 rounded-lg px-4 text-sm font-medium disabled:opacity-50"
    >
      {pending ? "…" : "Registrar"}
    </button>
  );
}

function macros(c: ComidaGuardada): string {
  const partes = [c.cantidad];
  if (c.calorias != null) partes.push(`${c.calorias} kcal`);
  if (c.proteina_g != null) partes.push(`${c.proteina_g} g prot.`);
  return partes.join(" · ");
}

/**
 * La biblioteca (§6.1) con el registro de un toque (§6.2).
 *
 * El orden lo decide el servidor por uso reciente y frecuencia, no este
 * componente: lo de siempre tiene que quedar arriba sin buscarlo.
 */
export function Biblioteca({ comidas }: { comidas: ComidaGuardada[] }) {
  const [estado, accion] = useActionState(
    async (_previo: EstadoBiblioteca, formData: FormData) =>
      registrarComida(formData),
    INICIAL,
  );

  const [editando, setEditando] = useState<string | null>(null);

  if (comidas.length === 0) {
    return (
      <p className="mt-4 text-sm text-suave">
        Todavía no has guardado ninguna comida. Añade la primera abajo: se
        define una vez y a partir de ahí se registra en un toque.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {estado.error && (
        <p role="alert" className="text-sm text-error">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-sm text-suave">
          {estado.aviso}
        </p>
      )}

      <ul className="space-y-2">
        {comidas.map((c) =>
          editando === c.id ? (
            <li key={c.id} className="alzado rounded-xl p-4">
              <FormularioComida
                comida={c}
                alTerminar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="alzado flex items-center justify-between gap-3 rounded-xl p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.nombre}</p>
                <p className="truncate text-xs text-suave">{macros(c)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <form action={accion}>
                  <input type="hidden" name="comida_id" value={c.id} />
                  <BotonRegistrar />
                </form>

                <button
                  type="button"
                  onClick={() => setEditando(c.id)}
                  className="rounded-lg px-2 py-1 text-xs text-suave hover:text-texto"
                >
                  Editar
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

/**
 * Alta y edición de una comida (§6.1).
 *
 * Un solo formulario para las dos cosas: con `comida` edita, sin ella crea. El
 * `key` del `useActionState` no hace falta porque el componente se monta y
 * desmonta al entrar y salir del modo edición.
 */
export function FormularioComida({
  comida,
  alTerminar,
}: {
  comida?: ComidaGuardada;
  alTerminar?: () => void;
}) {
  const [estado, accion] = useActionState(guardarComida, INICIAL);

  return (
    <div className="space-y-3">
      <form action={accion} className="space-y-3">
        {comida && <input type="hidden" name="id" value={comida.id} />}

        <div className="space-y-1.5">
          <label htmlFor={`nombre-${comida?.id ?? "nueva"}`} className="block text-sm font-medium">
            Nombre
          </label>
          <input
            id={`nombre-${comida?.id ?? "nueva"}`}
            name="nombre"
            defaultValue={comida?.nombre}
            placeholder="Pollo con arroz"
            className={claseCampo}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`cantidad-${comida?.id ?? "nueva"}`} className="block text-sm font-medium">
            Alimentos y cantidades
          </label>
          <input
            id={`cantidad-${comida?.id ?? "nueva"}`}
            name="cantidad"
            defaultValue={comida?.cantidad}
            placeholder="200 g de pollo, 80 g de arroz en crudo, 10 g de aceite"
            className={claseCampo}
          />
          {/* §6.1: la cantidad se piensa una vez, con calma. Es lo que hace que
              registrar después cueste un toque y siga siendo preciso. */}
          <p className="text-xs text-suave">
            Se escribe una vez. De aquí salen los macros, así que cuanto más
            concreto, mejor.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="w-32 space-y-1.5">
            <label htmlFor={`calorias-${comida?.id ?? "nueva"}`} className="block text-sm font-medium">
              kcal
            </label>
            <input
              id={`calorias-${comida?.id ?? "nueva"}`}
              name="calorias"
              type="number"
              min="0"
              step="1"
              defaultValue={comida?.calorias ?? ""}
              className={claseCampo}
            />
          </div>

          <div className="w-32 space-y-1.5">
            <label htmlFor={`proteina-${comida?.id ?? "nueva"}`} className="block text-sm font-medium">
              Proteína (g)
            </label>
            <input
              id={`proteina-${comida?.id ?? "nueva"}`}
              name="proteina_g"
              type="number"
              min="0"
              step="0.1"
              defaultValue={comida?.proteina_g ?? ""}
              className={claseCampo}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Boton
            texto={comida ? "Guardar cambios" : "Guardar comida"}
            cargando="Guardando…"
          />

          {alTerminar && (
            <button
              type="button"
              onClick={alTerminar}
              className="text-sm text-suave underline underline-offset-4"
            >
              Cancelar
            </button>
          )}

          {estado.error && (
            <span role="alert" className="text-sm text-error">
              {estado.error}
            </span>
          )}
          {estado.aviso && (
            <span role="status" className="text-sm text-suave">
              {estado.aviso}
            </span>
          )}
        </div>
      </form>

      {/* Borrar va en su propio formulario: anidarlo dentro del de guardar no es
          HTML válido y el navegador lo desanida por su cuenta. */}
      {comida && (
        <form action={borrarComida}>
          <input type="hidden" name="id" value={comida.id} />
          <button
            type="submit"
            className="text-xs text-suave underline underline-offset-4 hover:text-error"
          >
            Quitar de la biblioteca
          </button>
        </form>
      )}
    </div>
  );
}
