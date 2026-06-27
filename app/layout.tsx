import type { Metadata, Viewport } from "next";
import { Arimo, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";

// Dirección "Gen-Z monocromo" (rebrand v3): Arimo (sans variable, estilo Mango)
// en TODO el UI + titulares; Instrument Serif solo de acento mínimo (itálica).
const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  weight: "400",
  // Itálica real para los micro-acentos editoriales (wordmark, una palabra suelta):
  // sin esto el navegador sintetiza una itálica falsa (oblicua, no caligráfica).
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "stailist",
  description:
    "Tu stylist personal — un look listo para tu día en menos de 2 minutos.",
  appleWebApp: { capable: true, title: "stailist", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f4f3f1",
  // Bloquea el zoom accidental (doble-tap / pinch / al enfocar inputs) que
  // descuadra la vista en la PWA. Tradeoff conocido: también quita el zoom a
  // propósito; aceptable en una app controlada (no es contenido de lectura larga).
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Necesario para que env(safe-area-inset-*) funcione en PWA standalone (iOS):
  // sin esto, la barra inferior queda bajo el indicador de inicio ("muy abajo").
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="h-full">
      <body
        className={`${arimo.variable} ${instrument.variable} min-h-full antialiased`}
      >
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
