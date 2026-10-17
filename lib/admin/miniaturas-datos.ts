// LAS IMÁGENES DE LAS MINIATURAS DEL FEED (2026-10-17). La decisión de qué
// enseñar vive en lib/admin/miniaturas.ts; aquí sólo se van a buscar los looks y
// las prendas que ese plan pide y se firman sus rutas en UNA ida a Storage,
// igual que la ficha de persona (app/admin/usuarios/[id]/page.tsx).
//
// Los `.in(...)` van por lotes de 200: con 300 líneas en pantalla son hasta
// ~1800 ids, y PostgREST corta en 1000 filas sin avisar (lib/todas-las-filas.ts).

import { createClient } from "@/lib/supabase/server";
import { ITEM_IMAGE_SELECT, itemImageUrlSync, itemPrivatePaths, type ItemImageRow } from "@/lib/item-image";
import type { Momento } from "@/lib/admin/actividad";
import { detalleDePrendas, planDe, MAX_MINIATURAS, type ItemCrudo } from "@/lib/admin/miniaturas";

export type MiniPrenda = { imagen: string | null; nombre: string; swatch: string };

export type Miniaturas = {
  /** El try-on del look o, en un espejo, su foto. */
  foto: { url: string; nombre: string; sub: string | null } | null;
  prendas: MiniPrenda[];
  /** Cuántas prendas más había de las que se enseñan. */
  mas: number;
  /** En una ráfaga de looks, cuántos más hubo además del que se enseña. */
  masLooks: number;
  /** "19 con foto, 4 del catálogo". */
  detalle: string | null;
};

type OutfitRow = {
  id: string;
  title: string | null;
  explanation: string | null;
  item_ids: string[] | null;
  tryon_path: string | null;
  photo_path: string | null;
  source: string | null;
};

type ItemRow = ItemImageRow & { id: string; attrs?: { nombre?: string; color_hex?: string } | null };

const LOTE = 200;

async function porLotes<T>(ids: string[], traer: (lote: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += LOTE) out.push(...(await traer(ids.slice(i, i + LOTE))));
  return out;
}

/** key del momento → sus miniaturas. Sólo para los momentos que lleven algo. */
export async function cargarMiniaturas(momentos: Momento[], items: ItemCrudo[]): Promise<Map<string, Miniaturas>> {
  const planes = momentos.map((m) => [m.key, planDe(m, items)] as const).filter(([, p]) => p !== null);
  const out = new Map<string, Miniaturas>();
  if (planes.length === 0) return out;

  const supabase = await createClient();

  // 1. Los looks (para saber sus piezas) y las prendas sueltas de las tandas,
  //    en paralelo: no dependen entre sí. Las piezas de cada look van después.
  const outfitIds = [...new Set(planes.flatMap(([, p]) => (p!.clase === "look" ? [p!.outfitId] : [])))];
  const itemIdsDirectos = new Set<string>();
  for (const [, p] of planes) {
    if (p!.clase === "prendas" || p!.clase === "closet") p!.ids.forEach((id) => itemIdsDirectos.add(id));
  }
  const traerItems = (ids: string[]) =>
    porLotes(ids, async (lote) => {
      const { data } = await supabase.from("items").select(`id, ${ITEM_IMAGE_SELECT}`).in("id", lote);
      return (data ?? []) as unknown as ItemRow[];
    });
  const [filasOutfits, filasDirectas] = await Promise.all([
    porLotes(outfitIds, async (lote) => {
      const { data } = await supabase
        .from("outfits")
        .select("id, title, explanation, item_ids, tryon_path, photo_path, source")
        .in("id", lote);
      return (data ?? []) as OutfitRow[];
    }),
    traerItems([...itemIdsDirectos]),
  ]);
  const outfits = new Map<string, OutfitRow>();
  for (const o of filasOutfits) outfits.set(o.id, o);
  const prendas = new Map<string, ItemRow>();
  for (const i of filasDirectas) prendas.set(i.id, i);

  // 2. Las piezas de cada look que todavía no tengamos.
  const faltan = new Set<string>();
  for (const o of outfits.values()) {
    (o.item_ids ?? []).slice(0, MAX_MINIATURAS).forEach((id) => {
      if (!prendas.has(id)) faltan.add(id);
    });
  }
  for (const i of await traerItems([...faltan])) prendas.set(i.id, i);

  // 3. Firmar todo lo privado de una vez.
  const rutas = new Set<string>();
  for (const o of outfits.values()) {
    const ruta = o.source === "espejo" ? o.photo_path : o.tryon_path;
    if (ruta) rutas.add(ruta);
  }
  for (const i of prendas.values()) itemPrivatePaths(i).forEach((r) => rutas.add(r));
  const signed = new Map<string, string>();
  if (rutas.size > 0) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls([...rutas], 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  const miniDe = (id: string): MiniPrenda => {
    const i = prendas.get(id);
    if (!i) return { imagen: null, nombre: "Prenda", swatch: "#E5E1DD" };
    return {
      nombre: i.archetypes?.name ?? i.attrs?.nombre ?? "Prenda",
      swatch: i.attrs?.color_hex ?? "#E5E1DD",
      imagen: itemImageUrlSync(i, (p) => signed.get(p)),
    };
  };

  for (const [key, p] of planes) {
    if (p!.clase === "prendas") {
      out.set(key, { foto: null, prendas: p!.ids.map(miniDe), mas: p!.total - p!.ids.length, masLooks: 0, detalle: detalleDePrendas(p!) });
    } else if (p!.clase === "closet") {
      if (p!.total === 0) continue;
      out.set(key, { foto: null, prendas: p!.ids.map(miniDe), mas: p!.total - p!.ids.length, masLooks: 0, detalle: null });
    } else {
      const o = outfits.get(p!.outfitId);
      if (!o) continue;
      const ruta = o.source === "espejo" ? o.photo_path : o.tryon_path;
      const url = ruta ? signed.get(ruta) ?? null : null;
      const ids = o.item_ids ?? [];
      out.set(key, {
        foto: url ? { url, nombre: o.title ?? "Look", sub: o.explanation } : null,
        prendas: ids.slice(0, MAX_MINIATURAS).map(miniDe),
        mas: Math.max(0, ids.length - MAX_MINIATURAS),
        masLooks: p!.masLooks,
        detalle: null,
      });
    }
  }
  return out;
}
