import {
  BookOpen,
  Dumbbell,
  Home,
  Lightbulb,
  List,
  PencilLine,
  Target,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Destinos de la navegación (§22.2).
 *
 * El orden es fijo y no se reordena por uso reciente: la memoria muscular de
 * "el tercero de la lista" vale más que la optimización.
 *
 * Iconos de Lucide, nunca emoji: §21.9 lo prohíbe explícitamente porque los
 * emoji cambian de forma según el sistema operativo.
 */

export type Destino = {
  href: string;
  texto: string;
  icono: LucideIcon;
};

export const DESTINOS: readonly Destino[] = [
  { href: "/", texto: "Hoy", icono: Home },
  { href: "/chat", texto: "Registrar", icono: PencilLine },
  { href: "/rutinas", texto: "Entreno", icono: Dumbbell },
  { href: "/dieta", texto: "Dieta", icono: UtensilsCrossed },
  { href: "/historial", texto: "Historial", icono: List },
  { href: "/evolucion", texto: "Evolución", icono: TrendingUp },
  { href: "/insights", texto: "Insights", icono: Lightbulb },
  { href: "/objetivos", texto: "Objetivos", icono: Target },
  { href: "/principios", texto: "Principios", icono: BookOpen },
];

/**
 * Rutas sin navegación en ningún ancho (§22.3).
 *
 * La sesión de entreno en vivo se usa de pie, con prisa y a veces con las manos
 * sudadas. Un icono de menú ahí ocupa la superficie táctil más escasa de la app
 * y añade una forma de salirse del entreno por accidente. Su única salida es el
 * control explícito de terminar la sesión.
 *
 * El login también queda fuera: no hay a dónde navegar sin sesión.
 */
const SIN_NAVEGACION = ["/entreno/", "/login"];

export function ocultarNavegacion(ruta: string): boolean {
  return SIN_NAVEGACION.some(
    (prefijo) => ruta === prefijo || ruta.startsWith(prefijo),
  );
}

/**
 * Un destino está activo si la ruta coincide exactamente o es descendiente suya.
 * La portada se compara exacta: si no, estaría activa en todas las páginas.
 */
export function esActivo(href: string, ruta: string): boolean {
  return href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);
}
