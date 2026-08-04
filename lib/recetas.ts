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

// Imports ESTÁTICOS, uno por familia. La primera versión hacía
// `import(\`@/lib/engine/recetas/${f}.json\`)` sobre un arreglo de nombres: en
// desarrollo funciona, pero el bundler de producción no puede resolver una ruta
// que solo existe en tiempo de ejecución y la página reventaba con
// MODULE_NOT_FOUND. El listado explícito además documenta qué hay destilado.
import casualLimpio from "@/lib/engine/recetas/casual-limpio.json";
import clasicoArreglado from "@/lib/engine/recetas/clasico-arreglado.json";
import deportivo from "@/lib/engine/recetas/deportivo.json";
import edgy from "@/lib/engine/recetas/edgy.json";
import preppy from "@/lib/engine/recetas/preppy.json";
import resortBoho from "@/lib/engine/recetas/resort-boho.json";
import sastre from "@/lib/engine/recetas/sastre.json";
import streetUrbano from "@/lib/engine/recetas/street-urbano.json";
import thriftVintage from "@/lib/engine/recetas/thrift-vintage.json";
import utilitario from "@/lib/engine/recetas/utilitario.json";

const CARGADAS = [
  casualLimpio,
  clasicoArreglado,
  deportivo,
  edgy,
  preppy,
  resortBoho,
  sastre,
  streetUrbano,
  thriftVintage,
  utilitario,
] as unknown as { familia: string; conteo: Conteo; receta: RecetaDestilada }[];

export async function recetasConReconstruccion(): Promise<FamiliaConReceta[]> {
  const supabase = await createClient();
  const cargadas = CARGADAS;

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
