import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import type { LookMotor, BriefMotor } from "@/lib/comparador/motor";
import type { EvalBriefFila, EvalCorrida, NotaDeLook } from "./evales";

// Cargar una corrida de eval de la base. Aparte de evales.ts porque toca
// Supabase del servidor (misma división que el comparador).

/** Una prenda como la pinta la pantalla de calibración. */
export type PrendaEvalUI = {
  id: string;
  nombre: string;
  /**
   * El material, cuando NO está ya dicho en el nombre.
   *
   * Roberto, calibrando: "si hay un pantalón o camisa, no sé si es de lino o
   * qué, y eso influye". Y hay una razón más fuerte que la comodidad: el juez
   * de texto SÍ recibe el material (lookParaRubrica lo manda). Si quien
   * calibra juzga sin él, el acuerdo mide dos criterios distintos sobre dos
   * informaciones distintas — y ese número es justo el que decide si la
   * rúbrica sigue siendo confiable.
   *
   * null cuando el nombre ya lo dice ("Camisa de lino blanca"): repetirlo sería
   * ruido en una pantalla donde cada línea compite con la foto.
   */
  material: string | null;
  swatch: string;
  imagen: string | null;
};

export type EvalCorridaCargada = {
  corrida: EvalCorrida;
  filas: EvalBriefFila[];
  prendas: Record<string, PrendaEvalUI>;
};

export async function cargarEvalCorrida(
  corridaId: string
): Promise<EvalCorridaCargada | null> {
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("eval_corridas")
    .select("*")
    .eq("id", corridaId)
    .maybeSingle();
  if (!c) return null;

  const { data: briefs } = await supabase
    .from("eval_briefs")
    .select("*")
    .eq("corrida_id", corridaId)
    .order("n");

  const filas: EvalBriefFila[] = (briefs ?? []).map((b) => ({
    id: b.id as string,
    n: b.n as number,
    brief: b.brief as BriefMotor,
    looks: (b.looks as LookMotor[] | null) ?? null,
    reviews: (b.reviews as EvalBriefFila["reviews"]) ?? null,
    error: (b.error as string | null) ?? null,
    costoGenUsd: b.costo_gen_usd != null ? Number(b.costo_gen_usd) : null,
    msGen: (b.ms_gen as number | null) ?? null,
    notas: (b.notas as NotaDeLook[] | null) ?? null,
    costoNotasUsd: b.costo_notas_usd != null ? Number(b.costo_notas_usd) : null,
    marcas: (b.marcas as Record<string, string> | null) ?? null,
    comentarios: (b.comentarios as Record<string, string> | null) ?? null,
  }));

  // Las prendas de todos los looks, con imagen firmada — la calibración se
  // vota viendo lo mismo que el usuario vería, no una lista de nombres.
  const itemIds = Array.from(
    new Set(filas.flatMap((f) => (f.looks ?? []).flatMap((l) => l.item_ids)))
  );
  const prendas: Record<string, PrendaEvalUI> = {};
  if (itemIds.length > 0) {
    const { data: items } = await supabase
      .from("items")
      .select("id, photo_path, render_status, render_path, attrs, archetypes(name, image_path)")
      .in("id", itemIds);
    const list = items ?? [];
    const paths = list
      .flatMap((i) => [i.photo_path as string | null, i.render_path as string | null])
      .filter((p): p is string => !!p);
    const firmadas = new Map<string, string>();
    if (paths.length > 0) {
      const { data } = await supabase.storage
        .from("prendas")
        .createSignedUrls(Array.from(new Set(paths)), 3600);
      data?.forEach((s) => {
        if (s.path && s.signedUrl) firmadas.set(s.path, s.signedUrl);
      });
    }
    for (const i of list) {
      const arch = i.archetypes as { name?: string; image_path?: string | null } | null;
      const attrs = (i.attrs ?? {}) as {
        nombre?: string;
        color_hex?: string;
        material?: string;
      };
      const nombre = arch?.name ?? attrs.nombre ?? "Prenda";
      const material = attrs.material?.trim() || null;
      prendas[i.id as string] = {
        id: i.id as string,
        nombre,
        // Solo si aporta: si el nombre ya dice "lino", repetirlo es ruido.
        material:
          material && !nombre.toLowerCase().includes(material.toLowerCase())
            ? material
            : null,
        swatch: attrs.color_hex ?? "#E5E1DD",
        imagen: itemImageUrlSync(i as unknown as ItemImageRow, (p) => firmadas.get(p)),
      };
    }
  }

  return {
    corrida: {
      id: c.id as string,
      creada: c.creada as string,
      promptVersion: c.prompt_version as string,
      poolVersion: c.pool_version as string,
      modeloGenerador: c.modelo_generador as string,
      modeloJuez: c.modelo_juez as string,
      rubricaVersion: c.rubrica_version as string,
      rubricaVisionVersion: c.rubrica_vision_version as string,
      conEstilo: c.con_estilo === true,
      conColor: c.con_color === true,
      estado: c.estado as string,
      nota: (c.nota as string | null) ?? null,
    },
    filas,
    prendas,
  };
}
