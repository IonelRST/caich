"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Temporizador de descanso (§5.2).
 *
 * Arranca al marcar una serie y avisa al llegar a cero. Los dígitos van en
 * Barlow Condensed grande: es lo único de esta pantalla que se lee con el
 * brazo estirado, y por eso la §21.6 le reserva la familia condensada.
 *
 * La cuenta atrás es un número que cambia solo, que la §21.9 prohíbe para
 * valores medidos. Aquí no aplica: el cambio del número *es* el dato, no un
 * adorno sobre un dato que ya está quieto.
 */
export function Temporizador({
  segundos,
  alTerminar,
  alCerrar,
}: {
  segundos: number;
  alTerminar: () => void;
  alCerrar: () => void;
}) {
  const [restante, setRestante] = useState(segundos);
  const finRef = useRef(false);

  // El plazo se guarda como instante absoluto y no como contador que se
  // decrementa: un intervalo de navegador se retrasa en segundo plano, y en
  // una pantalla que se apaga a mitad de descanso eso acumula error.
  //
  // Se fija en el efecto y no al declarar el ref porque leer el reloj durante
  // el render es impuro. Quien monta este componente lo hace con `key` sobre
  // el descanso, así que un descanso nuevo es una instancia nueva y no hay
  // que resincronizar nada al cambiar `segundos`.
  const limiteRef = useRef<number | null>(null);

  useEffect(() => {
    limiteRef.current ??= Date.now() + segundos * 1000;

    const id = setInterval(() => {
      const quedan = Math.ceil(((limiteRef.current ?? 0) - Date.now()) / 1000);
      setRestante(quedan);
      if (quedan <= 0 && !finRef.current) {
        finRef.current = true;
        alTerminar();
      }
    }, 250);

    return () => clearInterval(id);
  }, [segundos, alTerminar]);

  const ajustar = (delta: number) => {
    const base = limiteRef.current ?? Date.now();
    limiteRef.current = Math.max(Date.now(), base + delta * 1000);
    setRestante(Math.ceil((limiteRef.current - Date.now()) / 1000));
    finRef.current = false;
  };

  const visible = Math.max(0, restante);
  const mm = Math.floor(visible / 60);
  const ss = String(visible % 60).padStart(2, "0");

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-superficie px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-alzado"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <button
          type="button"
          onClick={() => ajustar(-15)}
          className="control h-14 w-14 shrink-0 rounded-xl text-sm font-medium"
        >
          −15
        </button>

        <p className="flex-1 text-center font-cifra text-5xl font-semibold leading-none tabular-nums">
          {mm}:{ss}
        </p>

        <button
          type="button"
          onClick={() => ajustar(15)}
          className="control h-14 w-14 shrink-0 rounded-xl text-sm font-medium"
        >
          +15
        </button>

        <button
          type="button"
          onClick={alCerrar}
          className="h-14 shrink-0 rounded-lg px-3 text-sm text-suave underline underline-offset-4"
        >
          Saltar
        </button>
      </div>
    </div>
  );
}
