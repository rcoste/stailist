// Las recetas destiladas de cada familia, y su prueba de reconstrucción.
//
// Los JSON los produce scripts/destilar-familia.mjs mirando las fotos aprobadas
// de la familia, y viven en el repo (lib/engine/recetas/) porque son datos del
// motor, no material de trabajo: de aquí sale lo que el prompt le dice a la IA
// sobre cómo se lleva cada estilo.
//
// Las imágenes de reconstrucción viven en el bucket privado, no en public/:
// pesan ~1 MB cada una y el repo es público. Se sirven firmadas, igual que las
// referencias.

import { createClient } from "@/lib/supabase/server";

export type Formula = { look: string; clima: "calor" | "templado" | "frio" };

export type RecetaDestilada = {
  silueta: string;
  paleta: string;
  formulas: Formula[];
  detalles: string[];
  evitar: string[];
  capsula: string[];
  frio: string[];
};

export type Conteo = {
  total: string;
  calor: string;
  templado: string;
  frio: string;
  tierra: string;
  neutra: string;
  oscura: string;
  color: string;
  cenida: string;
  recta: string;
  holgada: string;
};

export type FamiliaConReceta = {
  familia: string;
  conteo: Conteo;
  receta: RecetaDestilada;
  /** Las 3 imágenes generadas SOLO con el texto de la receta, firmadas. */
  reconstruccion: string[];
};

// Import estático con glob no existe en Next sin bundler tricks; el listado
// explícito además documenta qué familias hay destiladas.
const ARCHIVOS = [
  "casual-limpio",
  "clasico-arreglado",
  "deportivo",
  "edgy",
  "preppy",
  "resort-boho",
  "sastre",
  "street-urbano",
  "thrift-vintage",
  "utilitario",
] as const;

export async function recetasConReconstruccion(): Promise<FamiliaConReceta[]> {
  const supabase = await createClient();

  const cargadas = await Promise.all(
    ARCHIVOS.map(async (f) => {
      const mod = await import(`@/lib/engine/recetas/${f}.json`);
      return mod.default as { familia: string; conteo: Conteo; receta: RecetaDestilada };
    })
  );

  // Una sola firma para las 30: firmar de a una multiplicaba las llamadas y la
  // página tardaba en abrir.
  const paths = cargadas.flatMap((c) =>
    [1, 2, 3].map((n) => `reconstruccion/${c.familia}-${n}.png`)
  );
  const { data: urls } = await supabase.storage
    .from("referencias")
    .createSignedUrls(paths, 3600);
  const porPath = new Map((urls ?? []).map((u) => [u.path, u.signedUrl]));

  return cargadas.map((c) => ({
    ...c,
    reconstruccion: [1, 2, 3]
      .map((n) => porPath.get(`reconstruccion/${c.familia}-${n}.png`))
      .filter((u): u is string => Boolean(u)),
  }));
}
