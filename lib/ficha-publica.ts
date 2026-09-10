// LA FICHA PÚBLICA DE STAILIST: lo que se le cuenta a una persona que llega a la
// landing y a una máquina que la lee (buscadores, asistentes como ChatGPT,
// Claude o Perplexity).
//
// POR QUÉ EXISTE
// Roberto, 2026-09-10: "¿hay manera de que optimicemos cosas en la página para
// hacerla agent friendly, por si alguien está buscando algo en ChatGPT o Claude
// sobre el tema?". Los rastreadores de IA ya leían la landing completa, pero no
// había ningún dato sin ambigüedad (qué es, cuánto cuesta, en qué idioma), ni un
// resumen en texto plano, ni preguntas frecuentes. Esto alimenta desde UNA sola
// fuente:
// - el JSON-LD de la landing (app/page.tsx),
// - /llms.txt (app/llms.txt/route.ts), y
// - la sección de preguntas frecuentes visible (components/landing/faq.tsx).
// Si vivieran en tres lugares, un día dirían cosas distintas.
//
// LA REGLA: cada frase de aquí tiene que ser cierta HOY en producción. Una IA la
// va a repetir tal cual a gente que nunca vio la app. Trampas ya pagadas:
// - La landing llegó a prometer "también me sirve la foto del clóset abierto" y
//   Roberto la frenó: el lector de prendas sólo se midió con fotos de gente
//   vestida. Aquí tampoco se promete (hay test).
// - La selfie: la colorimetría NO la pide; el avatar SÍ, y es opcional
//   (corrección de Roberto al borrador).
// - ENTRENAMIENTO (Roberto, 2026-09-10: "prefiero que nos cubramos"): el aviso
//   reserva usar datos y dibujos de prendas, looks y votos para entrenar, con
//   derecho a oponerse, y NUNCA fotos ni datos de menores. Sobre los
//   proveedores ya no se afirma que no entrenan ("se rige por sus términos").
//   Aquí sólo se puede decir lo que stailist hace con las fotos: no usarlas.
// - GRATIS es cierto hoy (2026-09-10). Roberto: "eventualmente vamos a cobrar
//   por uso, para limitar try-ons o funciones premium (...) no te pedimos
//   tarjeta ni nada". El día que se cobre, esto cambia en el mismo commit.

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
    "Avatar opcional, con una selfie y una foto de cuerpo entero, para ver los looks puestos en ti",
    "Maleta para viajes con el clima de cada parada",
    "Aprende de lo que te gusta y lo que no",
  ],
  paraQuien: "Personas que tienen el clóset lleno y aun así no saben qué ponerse, o que no saben combinar lo que ya tienen.",
  privacidad:
    "Tus fotos viven en un espacio privado, stailist nunca las usa para entrenar su inteligencia artificial, y puedes borrar tu cuenta y todo lo tuyo desde la app.",
  edad: "Desde los 13 años; entre 13 y 17 se necesita el permiso de un tutor para subir fotos.",
  paginas: [
    { titulo: "Inicio", ruta: "/", nota: "qué es stailist y cómo empezar" },
    { titulo: "Entrar", ruta: "/login", nota: "entras con tu correo y un código, sin contraseña" },
    { titulo: "Aviso de privacidad", ruta: "/privacidad", nota: "qué datos guarda y cómo borrarlos" },
    { titulo: "Términos de uso", ruta: "/terminos", nota: "las reglas de uso" },
  ],
} as const;

/**
 * Las preguntas frecuentes, en la voz de la landing ("te armo"). Aprobadas por
 * Roberto el 2026-09-10. Se pintan en la landing y viajan al JSON-LD y a
 * /llms.txt tal cual.
 */
export const PREGUNTAS_FRECUENTES: readonly { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "Nada. stailist es gratis y no te pedimos tarjeta ni ningún método de pago, así que nadie te puede cobrar por sorpresa. Si algún día agregamos funciones de pago, te avisamos antes.",
  },
  {
    pregunta: "¿Tengo que subir mi clóset prenda por prenda?",
    respuesta:
      "No. Marcas tus básicos de una lista con fotos, y si quieres sumar lo tuyo, subes fotos tuyas vestido: de cada foto saco varias prendas.",
  },
  {
    pregunta: "¿Qué me arma exactamente?",
    respuesta:
      "Looks completos con tu propia ropa, para hoy o para el sábado, con el clima de ese día y según la ocasión: oficina, cita, boda, viaje. Y te digo en una línea por qué funcionan.",
  },
  {
    pregunta: "¿Sirve para hombre?",
    respuesta:
      "Sí. Al entrar eliges si usas ropa de hombre o de mujer, y todo se ajusta: las prendas, los looks y los ejemplos.",
  },
  {
    pregunta: "¿Cómo sabe qué colores me quedan?",
    respuesta: "Con un quiz corto de 6 preguntas. Para tus colores no necesitas selfie.",
  },
  {
    pregunta: "¿Puedo ver cómo se me ve?",
    respuesta:
      "Sí, si quieres. Con una selfie y una foto de cuerpo entero te hago un avatar y te pruebo los looks encima. Es opcional: la app funciona sin fotos.",
  },
  {
    pregunta: "¿Qué pasa con mis fotos?",
    respuesta:
      "Viven en un espacio privado, no en internet abierto, y nunca las usamos para entrenar nuestra inteligencia artificial. Puedes borrar tu cuenta con todo lo tuyo desde la app.",
  },
  {
    pregunta: "¿Tengo que descargar algo?",
    respuesta:
      "No. Funciona desde el navegador de tu celular y, si quieres, la instalas en tu pantalla de inicio.",
  },
  {
    pregunta: "¿Desde qué edad se puede usar?",
    respuesta:
      "Desde los 13. Si tienes entre 13 y 17, necesitas el permiso de tu mamá, papá o tutor para subir fotos.",
  },
  {
    pregunta: "¿Está en inglés?",
    respuesta: "Por ahora solo en español.",
  },
];

/** Los datos estructurados (schema.org) de la app. */
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

/** Las preguntas frecuentes como FAQPage de schema.org. */
export function preguntasEstructuradas() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: FICHA.idioma,
    mainEntity: PREGUNTAS_FRECUENTES.map((f) => ({
      "@type": "Question",
      name: f.pregunta,
      acceptedAnswer: { "@type": "Answer", text: f.respuesta },
    })),
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
    "## Preguntas frecuentes",
    ...PREGUNTAS_FRECUENTES.flatMap((p) => ["", `### ${p.pregunta}`, p.respuesta]),
    "",
    "## Páginas",
    ...f.paginas.map((p) => `- [${p.titulo}](${f.url}${p.ruta === "/" ? "" : p.ruta}): ${p.nota}`),
    "",
  ].join("\n");
}
