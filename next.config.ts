import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Orígenes desde los que se puede abrir el servidor de desarrollo además de
   * localhost. Sin esto, Next devuelve 403 en parte de los chunks de cliente
   * cuando entras por la IP de la máquina: el HTML llega, React no hidrata, y
   * todo lo interactivo queda muerto sin un solo error visible en pantalla.
   *
   * Hace falta para probar en un móvil real dentro de la misma red. No afecta a
   * producción: en `next start` esta comprobación no existe.
   */
  allowedDevOrigins: ["192.168.0.168"],
};

export default nextConfig;
