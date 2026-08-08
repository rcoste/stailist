// Descripción rica de una prenda para el generador de imagen (Gemini). El prompt
// base (buildImagePrompt) solo envuelve esto en el flat-lay de catálogo; aquí
// metemos TODO el contexto que la prenda ya carga para que el render salga fiel
// (p. ej. un "short" no se confunda con uno de baño).
//
// Capa 2: si el estilista (Opus) dejó una descripción visual precisa, esa manda.
// Capa 1: si no, se arma con los atributos estructurados que ya existen.
// NO se excluye "swimwear" de plano: las cápsulas de playa SÍ incluyen trajes de
// baño legítimos; la desambiguación viene de la categoría + el detalle, no de un veto.

export type GarmentAttrs = {
  nombre: string;
  color?: string | null;
  categoria?: string | null; // top | saco | bottom | calzado | abrigo | vestido | accesorio
  formalidad?: string | null;
  temporada?: string | null;
  largo?: string | null;
  corte?: string | null;
  manga?: string | null;
  visual?: string | null; // descripción visual precisa del estilista (Capa 2)
};

const CAT_EN: Record<string, string> = {
  top: "prenda de torso (top)",
  bottom: "prenda inferior (bottom)",
  calzado: "calzado",
  abrigo: "abrigo / capa exterior",
  vestido: "vestido",
  accesorio: "accesorio",
};

/**
 * La DESCRIPCIÓN sola, sin la orden de renderizar.
 *
 * Existe porque hay dos consumidores con necesidades distintas. Texto→imagen
 * necesita la orden ("renderiza exactamente esto"): es todo lo que el modelo va
 * a tener. Imagen→imagen NO la necesita y le estorba — ahí la descripción sólo
 * señala CUÁL prenda sacar de la foto, y va incrustada a media frase dentro de
 * otro prompt que ya da sus propias órdenes. Dos imperativos peleando en la
 * misma instrucción es ruido, no énfasis.
 */
export function garmentDescPlain(g: GarmentAttrs): string {
  // Capa 2: descripción visual precisa del estilista → es la base del render.
  if (g.visual && g.visual.trim()) return g.visual.trim();

  // Capa 1: arma con los atributos estructurados que la prenda ya carga.
  const parts: string[] = [g.nombre.trim()];
  if (g.color && !g.nombre.toLowerCase().includes(g.color.toLowerCase())) {
    parts.push(`en color ${g.color}`);
  }

  const ctx: string[] = [];
  if (g.categoria && CAT_EN[g.categoria]) ctx.push(CAT_EN[g.categoria]);
  if (g.largo) ctx.push(String(g.largo));
  if (g.corte) ctx.push(`corte ${g.corte}`);
  if (g.manga) ctx.push(`manga ${g.manga}`);
  if (g.formalidad) ctx.push(String(g.formalidad));
  if (g.temporada && g.temporada !== "todo-el-año") ctx.push(`para clima ${g.temporada}`);

  let s = parts.join(" ");
  if (ctx.length) s += ` — ${ctx.join(", ")}`;
  return s;
}

/**
 * ¿La descripción visual guardada quedó obsoleta al corregir la prenda?
 *
 * Es una regla del dominio, no pegamento de una pantalla, y por eso vive aquí
 * junto a la descripción y no dentro de la acción que guarda.
 *
 * EL CASO QUE LA HIZO NECESARIA, y se armó solo el mismo día: la descripción
 * que escribe la visión al leer la foto ("chaqueta bomber de nylon NEGRO mate")
 * empezó a guardarse, y el generador de imagen le hace MÁS caso que al nombre
 * —es su Capa 2: si hay descripción, manda—. Encima, al cambiar el nombre la
 * ficha ofrece rehacer la imagen.
 *
 * Junta las tres cosas y sale el abrigo de Roberto: guardado como "Blazer
 * marrón de lana", corregido a "Abrigo de lana marrón", oferta aceptada… y la
 * descripción vieja, que dice blazer, vuelve a dibujar un blazer. Corriges,
 * aceptas, y te devuelve la misma prenda equivocada.
 *
 * Tirarla cae a la Capa 1 (nombre + atributos), que es como se renderizaba
 * antes de que esto existiera: se pierde detalle, no se gana un error. Y con la
 * foto original delante el detalle lo pone la imagen, no el texto.
 */
export function descripcionObsoleta(cambio: {
  nombreViejo?: string | null;
  nombreNuevo?: string | null;
  hexViejo?: string | null;
  hexNuevo?: string | null;
}): boolean {
  const txt = (v?: string | null) => (v ?? "").trim().toLowerCase();
  // Sólo cuenta como cambio si LLEGA un valor nuevo: guardar sin tocar el
  // nombre no puede tirar la descripción.
  const nombreCambio =
    !!cambio.nombreNuevo && txt(cambio.nombreNuevo) !== txt(cambio.nombreViejo);
  const colorCambio =
    !!cambio.hexNuevo && txt(cambio.hexNuevo) !== txt(cambio.hexViejo);
  return nombreCambio || colorCambio;
}

export function garmentRenderDesc(g: GarmentAttrs): string {
  const desc = garmentDescPlain(g);
  // La orden cambia según la capa: con descripción del estilista se habla de
  // "esta prenda"; sin ella, de "este tipo de prenda" — porque lo único que se
  // tiene es el nombre, y ahí sí hay que insistir en que no traiga otra.
  return g.visual && g.visual.trim()
    ? `${desc}. Renderiza exactamente esta prenda, fiel como producto de ropa real.`
    : `${desc}. Renderiza exactamente este tipo de prenda, fiel como producto de ropa real (la prenda nombrada, no otra distinta).`;
}
