import { FormularioLogin } from "./formulario";

export const metadata = {
  title: "Entrar · caich",
};

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string; error?: string }>;
}) {
  const { destino, error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <FormularioLogin destino={destino ?? "/"} errorInicial={error} />
    </main>
  );
}
