import type { Metadata } from "next";
import { Barlow_Condensed, Inter, Nunito } from "next/font/google";
import { Marco } from "./marco";
import "./globals.css";

// §21.6: el cuerpo, las etiquetas y todas las tablas. Es la familia que más
// texto lleva, y donde la legibilidad a 12-14px manda sobre el carácter.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// §21.6: titulares y nombres. Los terminales redondeados son lo que hace que
// una superficie blanda no parezca una superficie plana con sombra puesta
// encima. Solo en h1 y h2 — repartida por toda la interfaz, cansa.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// §21.6: exclusivamente para los dígitos grandes de la sesión en vivo, donde
// "112,5 kg × 8" tiene que caber grande en un móvil estrecho. No se usa en
// ninguna otra pantalla.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "caich",
  description:
    "Registro de entrenos, comida y medidas corporales, con gráficos de evolución.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${nunito.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Marco>{children}</Marco>
      </body>
    </html>
  );
}
