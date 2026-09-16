// "¿CÓMO NOS CONOCISTE?" — la atribución que las etiquetas del link no ven.
//
// profiles.origen (lib/origen.ts) sabe de qué anuncio llegó alguien porque el
// link trae utm/gclid. No sabe nada de quien llegó porque se lo contó una amiga
// o lo vio en un video y escribió el nombre: entra como "directo". Esta
// pregunta cubre esa mitad. Las dos respuestas se leen juntas en
// /admin/adquisicion, y cuando discrepan (link de Google, "me lo recomendó
// alguien") las dos son ciertas: el anuncio cerró lo que la amiga empezó.
//
// Las opciones van en el orden en que más probablemente llegue alguien HOY:
// la recomendación primero (así llegó todo el mundo hasta septiembre) y las
// redes donde vive el público de la campaña. El CHECK de la migración 0161
// repite esta lista: si se agrega una opción, se agrega en los dos lados.

export const OPCIONES_CONOCIO = [
  { id: "recomendacion", label: "me lo recomendó alguien" },
  { id: "instagram", label: "instagram" },
  { id: "tiktok", label: "tiktok" },
  { id: "facebook", label: "facebook" },
  { id: "google", label: "google" },
  { id: "otro", label: "otro lado" },
] as const;

export type ComoNosConocio = (typeof OPCIONES_CONOCIO)[number]["id"] | "omitido";

const VALIDOS = new Set<string>([...OPCIONES_CONOCIO.map((o) => o.id), "omitido"]);

export function esComoNosConocio(v: unknown): v is ComoNosConocio {
  return typeof v === "string" && VALIDOS.has(v);
}

/** Cómo se lee en el panel: la etiqueta, "saltó la pregunta" o "—" si nunca la vio. */
export function etiquetaConocio(v: unknown): string {
  if (v === "omitido") return "saltó la pregunta";
  const o = OPCIONES_CONOCIO.find((x) => x.id === v);
  return o ? o.label : "—";
}
