import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";

// Dirección "Atelier" (rebrand v2): Bodoni Moda (display serif, alto contraste)
// solo en titulares + justificación del outfit; Hanken Grotesk en TODO el UI.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "stailist",
  description:
    "Tu stylist personal — un look listo para tu día en menos de 2 minutos.",
  appleWebApp: { capable: true, title: "stailist", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F5F3F0",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full">
      <body
        className={`${hanken.variable} ${bodoni.variable} min-h-full antialiased`}
      >
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
