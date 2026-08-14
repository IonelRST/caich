"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  iniciarSesion,
  registrarse,
  type EstadoFormulario,
} from "./acciones";

const ESTADO_INICIAL: EstadoFormulario = {};

function Boton({ modo }: { modo: "entrar" | "registrar" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-accion px-4 py-2.5 text-sm font-medium text-sobre-accion transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {/* §13: feedback visual mientras se procesa, no un botón muerto */}
      {pending
        ? modo === "entrar"
          ? "Entrando…"
          : "Creando cuenta…"
        : modo === "entrar"
          ? "Entrar"
          : "Crear cuenta"}
    </button>
  );
}

export function FormularioLogin({
  destino,
  errorInicial,
}: {
  destino: string;
  errorInicial?: string;
}) {
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [estado, accion] = useActionState(
    modo === "entrar" ? iniciarSesion : registrarse,
    ESTADO_INICIAL,
  );

  // Un error del callback de confirmación llega por la URL. Se muestra solo
  // hasta que el usuario envía el formulario, momento en el que manda el
  // resultado de esa acción.
  const error = estado.error ?? errorInicial;

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">caich</h1>
      <p className="mt-1 text-sm text-suave">
        {modo === "entrar"
          ? "Entra para ver tus entrenos y medidas."
          : "Crea una cuenta para empezar a registrar."}
      </p>

      <form action={accion} className="mt-8 space-y-4">
        <input type="hidden" name="destino" value={destino} />

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-borde bg-transparent px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={
              modo === "entrar" ? "current-password" : "new-password"
            }
            required
            minLength={8}
            className="w-full rounded-lg border border-borde bg-transparent px-3 py-2 text-sm outline-none focus:border-accion focus:ring-2 focus:ring-accion/40"
          />
          {modo === "registrar" && (
            <p className="text-xs text-suave">
              Mínimo 8 caracteres.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error"
          >
            {error}
          </p>
        )}

        {estado.aviso && (
          <p
            role="status"
            className="rounded-lg bg-exito/10 px-3 py-2 text-sm text-exito"
          >
            {estado.aviso}
          </p>
        )}

        <Boton modo={modo} />
      </form>

      <p className="mt-6 text-center text-sm text-suave">
        {modo === "entrar" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <button
          type="button"
          onClick={() => setModo(modo === "entrar" ? "registrar" : "entrar")}
          className="font-medium text-texto underline underline-offset-4"
        >
          {modo === "entrar" ? "Crear una" : "Entrar"}
        </button>
      </p>
    </div>
  );
}
