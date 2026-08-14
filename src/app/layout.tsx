import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import "./globals.css";

// §21.6: una sola familia para toda la interfaz.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
      className={`${inter.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
