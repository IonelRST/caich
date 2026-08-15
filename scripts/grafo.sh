#!/bin/sh
# Ejecuta code-review-graph venga de donde venga.
#
# Los hooks que genera `code-review-graph install` sólo miran el PATH, así que
# en cuanto la herramienta vive en un venv o se invoca por uvx salen sin hacer
# nada y el grafo se queda obsoleto en silencio. Este script prueba las tres
# vías por orden de coste y usa la primera que responda.
#
# Para forzar un binario concreto: CRG_BIN=/ruta/al/code-review-graph
set -e

if [ -n "$CRG_BIN" ] && [ -x "$CRG_BIN" ]; then
    exec "$CRG_BIN" "$@"
fi

if command -v code-review-graph >/dev/null 2>&1; then
    exec code-review-graph "$@"
fi

for venv in "$HOME/.venv-crg" "$HOME/.local/share/crg" ./.venv ./venv; do
    if [ -x "$venv/bin/code-review-graph" ]; then
        exec "$venv/bin/code-review-graph" "$@"
    fi
done

if command -v uvx >/dev/null 2>&1; then
    exec uvx code-review-graph "$@"
fi

# Sin instalar no es un error: los hooks no deben romper el flujo de trabajo
# de alguien que no use esta herramienta.
echo "grafo.sh: code-review-graph no está disponible; se omite." >&2
exit 0
