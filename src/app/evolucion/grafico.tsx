"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MedidaHabitual } from "@/lib/datos/medidas";

export type PuntoSerie = {
  fecha: string; // ISO, para ordenar
  etiqueta: string; // formateada, para el eje
  valor: number;
};

export type SerieMedida = {
  nombre: string;
  etiqueta: string;
  unidad: string;
  puntos: PuntoSerie[];
};

function Resumen({ serie }: { serie: SerieMedida }) {
  if (serie.puntos.length < 2) return null;

  const primero = serie.puntos[0].valor;
  const ultimo = serie.puntos[serie.puntos.length - 1].valor;
  const diferencia = ultimo - primero;

  // Estadística pura (§11.1): aritmética sobre los propios datos, sin
  // interpretación. No afirma causas ni recomienda nada.
  return (
    <p className="mt-1 text-sm text-suave">
      {diferencia === 0
        ? "Sin cambio en el periodo registrado."
        : `${diferencia > 0 ? "+" : ""}${diferencia.toFixed(1)} ${serie.unidad} desde el primer registro.`}
    </p>
  );
}

export function GraficosEvolucion({ series }: { series: SerieMedida[] }) {
  const [activa, setActiva] = useState(series[0]?.nombre ?? "");

  if (series.length === 0) {
    return (
      <p className="mt-8 text-sm text-suave">
        Todavía no hay datos suficientes. Registra alguna medida y aquí verás su
        evolución.
      </p>
    );
  }

  const serie = series.find((s) => s.nombre === activa) ?? series[0];

  return (
    <div className="mt-8">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {series.map((s) => (
            <button
              key={s.nombre}
              type="button"
              onClick={() => setActiva(s.nombre)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                s.nombre === serie.nombre
                  ? "border-accion bg-accion text-sobre-accion"
                  : "border-borde hover:bg-superficie"
              }`}
            >
              {s.etiqueta}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-medium">
          {serie.etiqueta}{" "}
          <span className="font-normal text-suave">
            ({serie.unidad})
          </span>
        </h2>
        <Resumen serie={serie} />

        {serie.puntos.length === 1 ? (
          <p className="mt-4 text-sm text-suave">
            Solo hay un registro ({serie.puntos[0].valor} {serie.unidad}). Con
            un segundo dato ya se podrá dibujar la evolución.
          </p>
        ) : (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={serie.puntos}
                margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-borde"
                />
                <XAxis
                  dataKey="etiqueta"
                  tick={{ fontSize: 12 }}
                  className="fill-suave"
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 12 }}
                  className="fill-suave"
                />
                <Tooltip
                  formatter={(v) => `${v} ${serie.unidad}`}
                  labelFormatter={(l) => `${serie.etiqueta} · ${l}`}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--borde)",
                    backgroundColor: "var(--superficie)",
                    color: "var(--texto)",
                    fontSize: 13,
                  }}
                />
                {/* §21.5: las series usan la paleta categórica propia, nunca el
                    color de acción ni uno de estado. Un solo dato por gráfico
                    aquí, así que va la primera de la paleta. */}
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="var(--serie-1)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export type { MedidaHabitual };
