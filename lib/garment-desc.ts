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
  categoria?: string | null; // top | bottom | calzado | abrigo | vestido | accesorio
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

export function garmentRenderDesc(g: GarmentAttrs): string {
  // Capa 2: descripción visual precisa del estilista → es la base del render.
  if (g.visual && g.visual.trim()) {
    return `${g.visual.trim()}. Renderiza exactamente esta prenda, fiel como producto de ropa real.`;
  }

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
  s +=
    ". Renderiza exactamente este tipo de prenda, fiel como producto de ropa real (la prenda nombrada, no otra distinta).";
  return s;
}
