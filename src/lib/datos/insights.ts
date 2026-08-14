/**
 * Insights de nivel 1 — estadísticas puras (§11.1).
 *
 * Aritmética sobre los datos estructurados del usuario. Sin interpretación y sin
 * pasar por un modelo de lenguaje: son hechos, no afirmaciones sobre causas, y
 * por eso no necesitan ancla en la base de principios.
 *
 * Todo lo de aquí son funciones puras sobre filas ya leídas. Es deliberado: el
 * cálculo que sostiene un insight de salud tiene que poder comprobarse sin
 * montar una base de datos.
 */

export type Estadistica = {
  clave: string;
  titulo: string;
  /** El número, ya formateado. */
  valor: string;
  /**
   * Los datos concretos que lo sostienen. §11.2 lo exige para el nivel 2, pero
   * mostrarlos también aquí es lo que permite al usuario verificar la cifra en
   * vez de creérsela.
   */
  detalle: string;
  /** Cuántos registros hay detrás. Un dato con 2 muestras no vale lo que uno con 40. */
  muestras: number;
};

export type Nivel1 = {
  estadisticas: Estadistica[];
  /** §11.6: lo que no se puede calcular todavía, dicho explícitamente. */
  insuficiente: string[];
};

export type FilaMedida = {
  nombre: string;
  valor: number;
  fecha_evento: string;
};

export type FilaSerie = { peso: number | null; repeticiones: number | null };

export type FilaEntreno = {
  fecha_evento: string;
  ejercicios: {
    grupo_muscular: string | null;
    series: FilaSerie[];
  }[];
};

export type FilaComida = {
  fecha_evento: string;
  proteina_g: number | null;
  calorias: number | null;
  adherencia: string | null;
};

const DIA_MS = 86_400_000;

function numero(n: number, decimales = 1): string {
  return n.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  });
}

function conSigno(n: number, decimales = 1): string {
  return `${n > 0 ? "+" : ""}${numero(n, decimales)}`;
}

/** Clave de día local (YYYY-MM-DD), para agrupar sin que el huso desplace nada. */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  const desfase = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - desfase).toISOString().slice(0, 10);
}

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
});

/** Fecha legible, en el mismo formato que el historial y la portada. */
function fechaCorta(iso: string): string {
  return formatoFecha.format(new Date(iso));
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function dentroDe(iso: string, desde: number, hasta: number): boolean {
  const t = new Date(iso).getTime();
  return t >= desde && t < hasta;
}

/** Volumen de una serie: peso × repeticiones. Sin peso no aporta volumen. */
function volumenSerie(s: FilaSerie): number {
  if (s.peso == null || s.repeticiones == null) return 0;
  return s.peso * s.repeticiones;
}

/**
 * Cambio de una medida corporal en una ventana de días.
 *
 * Compara el primer y el último registro DENTRO de la ventana, no contra el
 * histórico entero: "has bajado 2 kg este mes" tiene que significar eso.
 */
export function cambioDeMedida(
  medidas: FilaMedida[],
  nombre: string,
  unidad: string,
  dias: number,
  ahora: number,
): Estadistica | string {
  const desde = ahora - dias * DIA_MS;
  const enVentana = medidas
    .filter((m) => m.nombre === nombre && new Date(m.fecha_evento).getTime() >= desde)
    .sort(
      (a, b) =>
        new Date(a.fecha_evento).getTime() - new Date(b.fecha_evento).getTime(),
    );

  if (enVentana.length < 2) {
    return `Necesito al menos dos registros de ${nombre.replace(/_/g, " ")} en los últimos ${dias} días para calcular una tendencia (hay ${enVentana.length}).`;
  }

  const primero = enVentana[0];
  const ultimo = enVentana[enVentana.length - 1];
  const delta = ultimo.valor - primero.valor;

  return {
    clave: `cambio_${nombre}`,
    titulo: `Cambio de ${nombre.replace(/_/g, " ")} (${dias} días)`,
    valor: `${conSigno(delta)} ${unidad}`,
    detalle: `De ${numero(primero.valor)} ${unidad} el ${fechaCorta(primero.fecha_evento)} a ${numero(ultimo.valor)} ${unidad} el ${fechaCorta(ultimo.fecha_evento)}.`,
    muestras: enVentana.length,
  };
}

/**
 * Sesiones de entreno en los últimos `dias` frente al periodo anterior de igual
 * duración.
 */
export function sesionesEntreno(
  entrenos: FilaEntreno[],
  dias: number,
  ahora: number,
): Estadistica | string {
  const inicioActual = ahora - dias * DIA_MS;
  const inicioPrevio = inicioActual - dias * DIA_MS;

  const actual = entrenos.filter((e) =>
    dentroDe(e.fecha_evento, inicioActual, ahora + DIA_MS),
  ).length;
  const previo = entrenos.filter((e) =>
    dentroDe(e.fecha_evento, inicioPrevio, inicioActual),
  ).length;

  if (actual === 0 && previo === 0) {
    return `No hay entrenos registrados en los últimos ${dias * 2} días.`;
  }

  return {
    clave: "sesiones",
    titulo: `Sesiones (${dias} días)`,
    valor: String(actual),
    detalle: `${actual} en los últimos ${dias} días, ${previo} en los ${dias} anteriores.`,
    muestras: actual + previo,
  };
}

/**
 * Volumen total (kg × repeticiones) en la ventana frente al periodo anterior.
 *
 * El porcentaje solo se calcula si el periodo anterior tuvo volumen: dividir
 * entre cero daría un "+∞ %" que no significa nada.
 */
export function volumenTotal(
  entrenos: FilaEntreno[],
  dias: number,
  ahora: number,
): Estadistica | string {
  const inicioActual = ahora - dias * DIA_MS;
  const inicioPrevio = inicioActual - dias * DIA_MS;

  const sumar = (desde: number, hasta: number) =>
    entrenos
      .filter((e) => dentroDe(e.fecha_evento, desde, hasta))
      .flatMap((e) => e.ejercicios)
      .flatMap((ej) => ej.series)
      .reduce((total, s) => total + volumenSerie(s), 0);

  const actual = sumar(inicioActual, ahora + DIA_MS);
  const previo = sumar(inicioPrevio, inicioActual);

  if (actual === 0) {
    return `Sin volumen registrado en los últimos ${dias} días (hacen falta series con peso y repeticiones).`;
  }

  const series = entrenos
    .filter((e) => dentroDe(e.fecha_evento, inicioActual, ahora + DIA_MS))
    .flatMap((e) => e.ejercicios)
    .flatMap((ej) => ej.series).length;

  const comparacion =
    previo > 0
      ? `${conSigno(((actual - previo) / previo) * 100, 0)} % frente a los ${dias} días anteriores (${numero(previo, 0)} kg·rep).`
      : `No hay volumen en los ${dias} días anteriores con el que comparar.`;

  return {
    clave: "volumen",
    titulo: `Volumen (${dias} días)`,
    valor: `${numero(actual, 0)} kg·rep`,
    detalle: `${series} series registradas. ${comparacion}`,
    muestras: series,
  };
}

/**
 * Volumen por grupo muscular en la ventana, ordenado de mayor a menor.
 * Es el dato que sostiene un insight tipo "tu volumen de pierna ha subido".
 */
export function volumenPorGrupo(
  entrenos: FilaEntreno[],
  dias: number,
  ahora: number,
): Estadistica[] {
  const inicioActual = ahora - dias * DIA_MS;
  const inicioPrevio = inicioActual - dias * DIA_MS;

  const porGrupo = (desde: number, hasta: number) => {
    const mapa = new Map<string, { volumen: number; series: number }>();
    for (const entreno of entrenos) {
      if (!dentroDe(entreno.fecha_evento, desde, hasta)) continue;
      for (const ej of entreno.ejercicios) {
        const grupo = ej.grupo_muscular ?? "Sin clasificar";
        const acumulado = mapa.get(grupo) ?? { volumen: 0, series: 0 };
        for (const s of ej.series) {
          acumulado.volumen += volumenSerie(s);
          acumulado.series += 1;
        }
        mapa.set(grupo, acumulado);
      }
    }
    return mapa;
  };

  const actual = porGrupo(inicioActual, ahora + DIA_MS);
  const previo = porGrupo(inicioPrevio, inicioActual);

  return [...actual.entries()]
    .filter(([, v]) => v.volumen > 0)
    .sort((a, b) => b[1].volumen - a[1].volumen)
    .map(([grupo, v]) => {
      const antes = previo.get(grupo)?.volumen ?? 0;
      const comparacion =
        antes > 0
          ? `${conSigno(((v.volumen - antes) / antes) * 100, 0)} % frente a los ${dias} días anteriores.`
          : "Sin volumen previo con el que comparar.";

      return {
        clave: `volumen_${grupo}`,
        titulo: grupo,
        valor: `${numero(v.volumen, 0)} kg·rep`,
        detalle: `${v.series} series. ${comparacion}`,
        muestras: v.series,
      };
    });
}

/**
 * Proteína media por día, contando solo los días con comida registrada.
 *
 * Dividir entre los 7 días de la semana incluyendo los días sin registrar daría
 * una media artificialmente baja, y sobre eso se podrían tomar decisiones de
 * dieta equivocadas.
 */
export function proteinaMedia(
  comidas: FilaComida[],
  dias: number,
  ahora: number,
): Estadistica | string {
  const desde = ahora - dias * DIA_MS;
  const enVentana = comidas.filter(
    (c) => new Date(c.fecha_evento).getTime() >= desde && c.proteina_g != null,
  );

  if (enVentana.length === 0) {
    return `No hay comidas con proteína registrada en los últimos ${dias} días.`;
  }

  const porDia = new Map<string, number>();
  for (const c of enVentana) {
    const dia = diaLocal(c.fecha_evento);
    porDia.set(dia, (porDia.get(dia) ?? 0) + (c.proteina_g ?? 0));
  }

  const total = [...porDia.values()].reduce((a, b) => a + b, 0);
  const media = total / porDia.size;

  const aviso =
    porDia.size < 3
      ? ` Con solo ${plural(porDia.size, "día", "días")} de datos, la media es poco representativa.`
      : "";

  return {
    clave: "proteina",
    titulo: `Proteína media diaria (${dias} días)`,
    valor: `${numero(media, 0)} g`,
    detalle: `${numero(total, 0)} g repartidos en ${plural(porDia.size, "día", "días")} con registro, sobre ${plural(enVentana.length, "comida", "comidas")}.${aviso}`,
    muestras: enVentana.length,
  };
}

/** Días con al menos una comida registrada. Es un hecho, no una medida de adherencia. */
export function diasConRegistro(
  comidas: FilaComida[],
  dias: number,
  ahora: number,
): Estadistica | string {
  const desde = ahora - dias * DIA_MS;
  const enVentana = comidas.filter(
    (c) => new Date(c.fecha_evento).getTime() >= desde,
  );

  if (enVentana.length === 0) {
    return `No hay comidas registradas en los últimos ${dias} días.`;
  }

  const unicos = new Set(enVentana.map((c) => diaLocal(c.fecha_evento)));

  return {
    clave: "dias_registro",
    titulo: `Días con comida registrada (${dias} días)`,
    valor: `${unicos.size} de ${dias}`,
    detalle: `${plural(enVentana.length, "comida", "comidas")} registradas en total.`,
    muestras: enVentana.length,
  };
}

/**
 * Adherencia al plan de dieta, solo sobre las comidas que declararon una.
 * Las comidas registradas por chat no llevan adherencia, así que quedan fuera.
 */
export function adherenciaPlan(
  comidas: FilaComida[],
  dias: number,
  ahora: number,
): Estadistica | string {
  const desde = ahora - dias * DIA_MS;
  const conAdherencia = comidas.filter(
    (c) => new Date(c.fecha_evento).getTime() >= desde && c.adherencia != null,
  );

  if (conAdherencia.length === 0) {
    return `Sin check-ins de dieta en los últimos ${dias} días: no hay adherencia que medir.`;
  }

  const iguales = conAdherencia.filter((c) => c.adherencia === "igual").length;

  return {
    clave: "adherencia",
    titulo: `Adherencia al plan (${dias} días)`,
    valor: `${iguales} de ${conAdherencia.length}`,
    detalle: `${plural(iguales, "comida", "comidas")} según el plan, ${conAdherencia.length - iguales} con desviación.`,
    muestras: conAdherencia.length,
  };
}

/** Reúne todo el nivel 1, separando lo calculable de lo que aún no da (§11.6). */
export function calcularNivel1(
  medidas: FilaMedida[],
  entrenos: FilaEntreno[],
  comidas: FilaComida[],
  ahora: number,
): Nivel1 {
  const resultados = [
    cambioDeMedida(medidas, "peso", "kg", 30, ahora),
    sesionesEntreno(entrenos, 7, ahora),
    volumenTotal(entrenos, 7, ahora),
    proteinaMedia(comidas, 7, ahora),
    diasConRegistro(comidas, 7, ahora),
    adherenciaPlan(comidas, 7, ahora),
  ];

  const estadisticas = resultados.filter(
    (r): r is Estadistica => typeof r !== "string",
  );
  const insuficiente = resultados.filter((r): r is string => typeof r === "string");

  return {
    estadisticas: [...estadisticas, ...volumenPorGrupo(entrenos, 7, ahora)],
    insuficiente,
  };
}
