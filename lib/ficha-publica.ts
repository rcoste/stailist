// LA FICHA PÚBLICA DE STAILIST: lo que se le cuenta a una máquina que lee la
// landing (buscadores, asistentes como ChatGPT, Claude o Perplexity).
//
// POR QUÉ EXISTE
// Roberto, 2026-09-10: "¿hay manera de que optimicemos cosas en la página para
// hacerla agent friendly, por si alguien está buscando algo en ChatGPT o Claude
// sobre el tema?". Los rastreadores de IA ya leían la landing completa, pero no
// había ningún dato sin ambigüedad (qué es, cuánto cuesta, en qué idioma) ni un
// resumen en texto plano. Esto alimenta dos cosas desde UNA sola fuente:
// - el JSON-LD de la landing (app/page.tsx), y
// - /llms.txt (app/llms.txt/route.ts).
// Si viven en dos lugares, un día dicen cosas distintas.
//
// LA REGLA: cada frase de aquí tiene que ser cierta HOY en producción. Una IA la
// va a repetir tal cual a gente que nunca vio la app. Dos trampas ya pagadas:
// - La landing llegó a prometer "también me sirve la foto del clóset abierto" y
//   Roberto la frenó: el lector de prendas sólo se midió con fotos de gente
//   vestida. Aquí tampoco se promete (hay test).
// - GRATIS es cierto hoy (2026-09-10), pero Roberto ya dijo que "eventualmente
//   vamos a cobrar por algo, por uso, para limitar try-ons o funciones
//   premium". El día que se cobre, esto cambia en el mismo commit.

export const FICHA = {
  nombre: "stailist",
  url: "https://stailist.co",
  idioma: "es",
  resumen:
    "Stylist personal con IA que arma outfits con la ropa que ya tienes, para tu día, el clima y la ocasión.",
  descripcion:
    "stailist arma looks completos con la ropa que ya tienes, pensados para tu día, el clima y la ocasión, y te explica en una línea por qué funcionan. Funciona para ropa de hombre y de mujer, en español, desde el navegador del celular.",
  precio: "Gratis y sin tarjeta.",
  funciones: [
    "Looks con tu propia ropa para hoy o para otro día, con el clima de ese día",
    "Looks para ocasiones: oficina, cita, cena, boda, graduación y más",
    "Clóset rápido: marcas tus básicos de una lista con imágenes, o subes fotos tuyas vestido y de cada foto salen varias prendas",
    "Colorimetría con un quiz corto, sin selfie",
    "Avatar opcional para ver los looks puestos en ti",
    "Maleta para viajes con el clima de cada parada",
    "Aprende de lo que te gusta y lo que no",
  ],
  paraQuien: "Personas que tienen el clóset lleno y aun así no saben qué ponerse, o que no saben combinar lo que ya tienen.",
  privacidad:
    "Tus fotos viven en un espacio privado, los proveedores de IA no las usan para entrenar sus modelos, y puedes borrar tu cuenta y todo lo tuyo desde la app.",
  edad: "Desde los 13 años; entre 13 y 17 se necesita el permiso de un tutor para subir fotos.",
  paginas: [
    { titulo: "Inicio", ruta: "/", nota: "qué es stailist y cómo empezar" },
    { titulo: "Entrar", ruta: "/login", nota: "entras con tu correo y un código, sin contraseña" },
    { titulo: "Aviso de privacidad", ruta: "/privacidad", nota: "qué datos guarda y cómo borrarlos" },
    { titulo: "Términos de uso", ruta: "/terminos", nota: "las reglas de uso" },
  ],
} as const;

/** Los datos estructurados (schema.org) de la landing. */
export function datosEstructurados() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: FICHA.nombre,
    url: FICHA.url,
    description: FICHA.descripcion,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web (iPhone y Android desde el navegador)",
    inLanguage: FICHA.idioma,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" },
    featureList: [...FICHA.funciones],
  };
}

/**
 * JSON listo para ir dentro de un <script> en el HTML. El `<` se escapa: sin
 * eso, un texto con "</script>" cerraría la etiqueta y lo que siga se
 * interpretaría como HTML.
 */
export function serializarParaScript(dato: unknown): string {
  return JSON.stringify(dato).replace(/</g, "\\u003c");
}

/** El resumen en Markdown que se sirve en /llms.txt. */
export function textoLlms(): string {
  const f = FICHA;
  return [
    `# ${f.nombre}`,
    "",
    `> ${f.resumen}`,
    "",
    f.descripcion,
    "",
    "## Qué hace",
    ...f.funciones.map((x) => `- ${x}`),
    "",
    "## Datos",
    `- Precio: ${f.precio}`,
    `- Idioma: español`,
    `- Para quién: ${f.paraQuien}`,
    `- Dónde: en el navegador del celular o la computadora; se puede instalar en la pantalla de inicio, sin tienda de apps.`,
    `- Edad: ${f.edad}`,
    `- Privacidad: ${f.privacidad}`,
    "",
    "## Páginas",
    ...f.paginas.map((p) => `- [${p.titulo}](${f.url}${p.ruta === "/" ? "" : p.ruta}): ${p.nota}`),
    "",
  ].join("\n");
}
