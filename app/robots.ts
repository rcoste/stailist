import type { MetadataRoute } from "next";

// Qué puede indexar un buscador. Sólo lo público: la landing, el login y las
// legales. Todo lo demás es de una persona con sesión y no tiene por qué
// aparecer en Google aunque el proxy lo redirija a /login.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/privacidad", "/terminos"],
      disallow: ["/hoy", "/closet", "/historial", "/perfil", "/viaje", "/wishlist", "/cartera", "/onboarding", "/admin", "/api"],
    },
    sitemap: "https://stailist.co/sitemap.xml",
  };
}
