import type { MetadataRoute } from "next";

// Manifest de la PWA. Next.js auto-inyecta <link rel="manifest"> al existir
// este archivo. Colores y nombre alineados al DS (burdeos + papel hueso).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "stailist — tu stylist personal",
    short_name: "stailist",
    description:
      "Tu stylist personal: un look listo para tu día en menos de 2 minutos.",
    start_url: "/hoy",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f3f0",
    theme_color: "#f5f3f0",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
