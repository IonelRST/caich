import { FormularioChat } from "./formulario";
import { modeloEnUso } from "@/lib/ia/proveedor";

export default function Chat() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Registrar</h1>
        <p className="mt-2 text-sm text-suave">
          Escribe en lenguaje normal. Puedes mezclar peso, comida y entreno en un
          mismo mensaje: se separan y se guardan por su cuenta. Si algo no queda
          claro, se pregunta en vez de inventarlo.
        </p>
      </header>

      <section className="mt-8">
        <FormularioChat />
      </section>

      <footer className="mt-10 border-t border-borde pt-6">
        <p className="text-xs text-suave">
          Modelo en uso para el parseo: {modeloEnUso("parseo")}. El texto
          original de cada mensaje se conserva, para poder revisar el parseo si
          sale mal.
        </p>
      </footer>
    </main>
  );
}
