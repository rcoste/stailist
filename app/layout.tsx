import type { Metadata, Viewport } from "next";
import { Outfit, Fraunces } from "next/font/google";
import "./globals.css";
import { PwaInstall } from "@/components/pwa-install";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
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
        className={`${outfit.variable} ${fraunces.variable} min-h-full antialiased`}
      >
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
