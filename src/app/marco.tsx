"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DESTINOS,
  esActivo,
  ocultarNavegacion,
  type Destino,
} from "@/lib/navegacion";

/**
 * Marco de navegación (§22).
 *
 * Un único componente con dos presentaciones según el ancho, no dos menús que
 * haya que mantener en paralelo: barra lateral fija desde 1024px, drawer
 * superpuesto por debajo.
 *
 * Es cliente porque necesita la ruta activa y el estado del drawer, pero los
 * `children` llegan ya renderizados en el servidor: envolver no los convierte en
 * cliente.
 */
export function Marco({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);

  const refPanel = useRef<HTMLDivElement>(null);
  const refBoton = useRef<HTMLButtonElement>(null);
  const refToqueX = useRef<number | null>(null);

  const cerrar = useCallback(() => setAbierto(false), []);

  // §22.3: en la sesión en vivo no hay barra, ni botón, ni hueco reservado.
  const sinNavegacion = ocultarNavegacion(ruta);

  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
        return;
      }

      // §22.4: el foco queda contenido en el drawer mientras está abierto.
      if (e.key !== "Tab" || !refPanel.current) return;

      const foco = refPanel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (foco.length === 0) return;

      const primero = foco[0];
      const ultimo = foco[foco.length - 1];

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener("keydown", alPulsar);

    // El foco entra en el drawer al abrirse.
    refPanel.current?.querySelector<HTMLElement>("a[href]")?.focus();

    // El fondo no se desplaza mientras el drawer está encima.
    const desbordePrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = desbordePrevio;
    };
  }, [abierto, cerrar]);

  // Al cerrarse, el foco vuelve al botón que lo abrió (§22.4). Se hace en un
  // efecto propio para no devolver el foco en el primer render.
  const eraAbierto = useRef(false);
  useEffect(() => {
    if (eraAbierto.current && !abierto) refBoton.current?.focus();
    eraAbierto.current = abierto;
  }, [abierto]);

  if (sinNavegacion) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      {/* Barra lateral persistente desde 1024px. Sin botón de menú aquí. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-borde bg-superficie lg:flex">
        <Marca />
        <Destinos ruta={ruta} />
      </aside>

      {/* Cabecera con el disparador del drawer, solo por debajo de 1024px. */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-borde bg-fondo/95 px-4 py-2 backdrop-blur lg:hidden">
        <button
          ref={refBoton}
          type="button"
          onClick={() => setAbierto(true)}
          aria-expanded={abierto}
          aria-controls="navegacion-principal"
          aria-label="Abrir navegación"
          className="flex size-11 items-center justify-center rounded-lg border border-borde transition-colors hover:bg-superficie focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accion"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
        <span className="text-sm font-semibold tracking-tight">caich</span>
      </header>

      {/*
        Velo. Se monta siempre para poder animar la salida, y se apaga con
        pointer-events para no interceptar toques cuando está cerrado.
      */}
      <div
        onClick={cerrar}
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity motion-reduce:transition-none lg:hidden ${
          abierto
            ? "pointer-events-auto opacity-100 duration-200"
            : "pointer-events-none opacity-0 duration-150"
        }`}
      />

      {/*
        Drawer. Se superpone, no empuja el contenido (§22.4). La entrada va a
        200ms y la salida a 150ms: las salidas van más rápidas que las entradas
        (§21.8). Con prefers-reduced-motion aparece sin desplazamiento.
      */}
      <div
        ref={refPanel}
        id="navegacion-principal"
        role="dialog"
        aria-modal={abierto}
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-borde bg-superficie transition-transform ease-out motion-reduce:transition-none lg:hidden ${
          abierto
            ? "translate-x-0 duration-200"
            : "-translate-x-full duration-150"
        } ${abierto ? "" : "invisible motion-reduce:hidden"}`}
        onTouchStart={(e) => {
          refToqueX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          // §22.4: se cierra deslizando hacia el lado.
          if (refToqueX.current === null) return;
          if (refToqueX.current - e.changedTouches[0].clientX > 50) cerrar();
          refToqueX.current = null;
        }}
      >
        <div className="flex items-center justify-between border-b border-borde px-5 py-4">
          <span className="text-base font-semibold tracking-tight">caich</span>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar navegación"
            className="flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-fondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accion"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {/*
          El drawer se cierra al elegir destino. No se hace observando la ruta:
          §22.4 dice que el botón atrás navega y NO cierra el menú, así que el
          cierre pertenece al clic, no al cambio de página.
        */}
        <Destinos ruta={ruta} alNavegar={cerrar} />
      </div>

      {/* La barra sí reserva su espacio en el layout, sin solapar (§22.4). */}
      <div className="lg:pl-60">{children}</div>
    </div>
  );
}

function Marca() {
  return (
    <div className="border-b border-borde px-5 py-5">
      <span className="text-base font-semibold tracking-tight">caich</span>
      <span className="mt-0.5 block text-xs text-suave">
        Instrumento de medida
      </span>
    </div>
  );
}

function Destinos({
  ruta,
  alNavegar,
}: {
  ruta: string;
  alNavegar?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-3">
      <ul className="space-y-1">
        {DESTINOS.map((d) => (
          <li key={d.href}>
            <Entrada
              destino={d}
              activo={esActivo(d.href, ruta)}
              alNavegar={alNavegar}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Entrada({
  destino,
  activo,
  alNavegar,
}: {
  destino: Destino;
  activo: boolean;
  alNavegar?: () => void;
}) {
  const Icono = destino.icono;

  return (
    <Link
      href={destino.href}
      onClick={alNavegar}
      aria-current={activo ? "page" : undefined}
      /*
        §22.2 y §21.9: el destino activo se marca con indicador de forma —la barra
        de acento a la izquierda— ADEMÁS de color, nunca solo con color. El borde
        transparente en estado normal reserva el espacio para que el texto no se
        desplace al activarse.
      */
      className={`flex min-h-11 items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accion ${
        activo
          ? "border-l-accion bg-fondo font-medium text-texto"
          : "border-l-transparent text-suave hover:bg-fondo hover:text-texto"
      }`}
    >
      <Icono aria-hidden="true" className="size-[18px] shrink-0" />
      {destino.texto}
    </Link>
  );
}
