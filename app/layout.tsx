import type { Metadata, Viewport } from "next";
import { Arimo, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";
import { ViewAsBanner } from "@/components/view-as-banner";

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

// LA PROMESA DE TIEMPO, MEDIDA (2026-09-01). Decía "en menos de 2 minutos" —
// aquí y en otros cinco lugares. El TTV real de las 18 personas que terminaron
// el onboarding tiene una mediana de 7 min 47 s y ninguna bajó de 4 minutos, y
// el 77 % de ese tiempo es el onboarding, no la IA. Prometer un número que se
// falla por 4× quema la confianza en el primer minuto, así que la promesa baja
// a algo cierto hasta que el recorte del onboarding la sostenga MEDIDA.
export const metadata: Metadata = {
  // Desde la apertura (B5): sin metadataBase y openGraph, compartir el link en
  // WhatsApp o iMessage no mostraba imagen ni título propio. La imagen la
  // genera app/opengraph-image.tsx.
  metadataBase: new URL("https://stailist.co"),
  title: "stailist",
  description:
    "Tu stylist personal — un look listo para tu día, con la ropa que ya tienes.",
  openGraph: {
    title: "stailist — tu stylist personal con IA",
    description: "Te armo outfits con la ropa que ya tienes. Sin subir tu clóset prenda por prenda.",
    url: "https://stailist.co",
    siteName: "stailist",
    locale: "es_MX",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
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
        <ViewAsBanner />
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
