// EL TÍTULO DE LA LANDING SIGUE AL ANUNCIO QUE TOCASTE.
//
// POR QUÉ EXISTE: el 2026-10-05, la primera mañana de Instagram, 42 personas
// llegaron desde los anuncios y 1 tocó "Armar mi primer look" (2%), contra 5 de
// 8 de la campaña de Google que busca una app. Quien toca el video de la maleta
// ("dime a dónde vas, te armo la maleta") caía en un título que habla de otra
// cosa ("tu clóset está lleno y no sabes qué ponerte"): venía por una promesa y
// la página no se la confirmaba. Aquí cada anuncio trae su propio título; lo
// demás de la página no cambia.
//
// La llave es el utm_campaign SIN el prefijo del canal (ig-maleta y tt-maleta
// son el mismo video), así que TikTok hereda los títulos sin tocar nada. Lo que
// no está en la lista —Google, orgánico, un anuncio nuevo— ve el título de
// siempre.
//
// SE MIDE con las marcas del embudo por campaña (lib/embudo-marcas.ts): cuántos
// tocan el botón de cada 100 que llegan, antes y después de este cambio. Es una
// comparación antes/después, no un experimento con grupo de control: Meta sigue
// aprendiendo esos mismos días, así que una mejora chica no se distingue del
// ruido. Una que lleve el 2% a 10% sí.

export type TituloLanding = {
  /** El título, partido en lo de antes y la palabra en serif itálica (el estilo de la casa). */
  antes: string;
  enfasis: string;
  despues?: string;
  sub: string;
};

const TITULOS: Record<string, TituloLanding> = {
  maleta: {
    antes: "Dime a dónde vas. Te armo la ",
    enfasis: "maleta",
    despues: ".",
    sub: "Con tu propia ropa, look por look, para cada día del viaje y con el clima de allá.",
  },
  "salgo-igual": {
    antes: "¿Sales igual en todas tus ",
    enfasis: "fotos",
    despues: "?",
    sub: "No te falta ropa: te faltan combinaciones. Te armo looks nuevos con lo que ya tienes.",
  },
  etiqueta: {
    antes: "Tienes ropa que nunca te ",
    enfasis: "pones",
    despues: ".",
    sub: "Te armo looks con lo que ya está en tu clóset, para que por fin salga del gancho.",
  },
  jeans: {
    antes: "El problema no son tus jeans. Es con qué los ",
    enfasis: "combinas",
    despues: ".",
    sub: "Los mismos jeans, tres looks distintos. Te armo esto con la ropa que ya tienes.",
  },
};

/** Lo que va después del prefijo del canal; null si no es un anuncio conocido. */
export function anuncioDeCampana(campana: string | null | undefined): string | null {
  if (typeof campana !== "string") return null;
  const m = /^(?:ig|tt)-([a-z0-9-]{1,40})$/.exec(campana.trim().toLowerCase());
  return m && TITULOS[m[1]] ? m[1] : null;
}

export function tituloParaCampana(campana: string | null | undefined): TituloLanding | null {
  const k = anuncioDeCampana(campana);
  return k ? TITULOS[k] : null;
}
