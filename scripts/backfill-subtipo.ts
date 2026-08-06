import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}
import { createClient } from "@supabase/supabase-js";
import { VISION_MODEL } from "../lib/models";
import { leerPrenda } from "../lib/vision-prenda";

// Rellenar el TIPO FINO de lo que ya está en la base.
//
// POR QUÉ HACE FALTA
// El subtipo (derby/oxford, cruzado/sencillo, con pinzas) entró con el prompt
// v38, y sólo lo traen las prendas NUEVAS: de las 953 guardadas, CERO lo tienen.
// O sea que la mejora del motor está subida pero es letra muerta para todos los
// clósets que existen hoy.
//
// POR QUÉ AHORA Y NO ANTES
// Porque leer una prenda dejó de costar $0.017 y pasa a costar $0.0008: con
// Opus este relleno costaba ~$19 y ahora cuesta menos de un dólar. La decisión
// de modelo (docs/decisiones/vision-2026-08-05.md) es lo que lo volvió trivial.
//
// LA OPTIMIZACIÓN QUE LO HACE BARATO
// 645 de las 953 prendas vienen del catálogo, y salen de sólo 176 ARQUETIPOS
// distintos. Se lee cada arquetipo UNA vez y el subtipo se guarda en él, no en
// cada prenda: conCategoria lo resuelve al leer. Así son ~484 lecturas en vez
// de 953, y si mañana alguien corrige un arquetipo no quedan 645 copias viejas.
//
// SOLO ESCRIBE `subtipo`. No toca color, material ni nada que la persona ya
// haya confirmado o corregido a mano — sería pisarle su trabajo con la lectura
// de un modelo.

const SOLO = Number((process.argv.find((a) => a.startsWith("--n=")) ?? "--n=0").split("=")[1]);
const TOPE_USD = Number(
  (process.argv.find((a) => a.startsWith("--tope=")) ?? "--tope=3").split("=")[1]
);
const SECO = process.argv.includes("--seco");
/**
 * Cuántas lecturas a la vez. En serie, 716 imágenes a ~1.5s son 18 minutos de
 * nada; de a seis bajan a tres. Seis y no veinte porque el proveedor tiene
 * límite de ritmo y un 429 aquí obliga a reintentar lo que ya se pagó.
 */
const CONC = Number((process.argv.find((a) => a.startsWith("--conc=")) ?? "--conc=6").split("=")[1]);

/** Corre `tarea` sobre cada elemento, CONC a la vez, en orden de llegada. */
async function enTanda<T>(xs: T[], tarea: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONC, xs.length) }, async () => {
      while (i < xs.length) {
        if (gastado >= TOPE_USD) return;
        await tarea(xs[i++]);
      }
    })
  );
}

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let gastado = 0;
let leidas = 0;
let fallos = 0;

async function bytesDe(ruta: string, publica: boolean) {
  const url = publica
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co"}${ruta}`
    : (await s.storage.from("prendas").createSignedUrl(ruta, 600)).data?.signedUrl;
  if (!url) return null;
  const r = await fetch(url);
  if (!r.ok) return null;
  return {
    base64: Buffer.from(await r.arrayBuffer()).toString("base64"),
    mediaType: r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
  };
}

/** Lee una imagen y devuelve sólo el subtipo. null si no lo distingue. */
async function subtipoDe(ruta: string, publica: boolean): Promise<string | null | "error"> {
  const img = await bytesDe(ruta, publica);
  if (!img) return "error";
  try {
    const { analisis, recibo } = await leerPrenda(img, VISION_MODEL);
    gastado += recibo.costoUsd ?? 0;
    leidas++;
    return analisis.subtipo?.trim() || null;
  } catch {
    fallos++;
    return "error";
  }
}

async function main() {
  console.log(`modelo: ${VISION_MODEL.etiqueta} · tope de gasto: $${TOPE_USD}${SECO ? " · SECO (no escribe)" : ""}\n`);

  // ── 1) Arquetipos del catálogo (cubren 645 prendas con 176 lecturas) ──
  const { data: arqs } = await s
    .from("archetypes")
    .select("id, name, image_path, attrs")
    .not("image_path", "is", null);

  const pendientesArq = (arqs ?? []).filter(
    (a) => !(a.attrs as { subtipo?: string } | null)?.subtipo
  );
  console.log(`arquetipos por leer: ${pendientesArq.length} de ${arqs?.length ?? 0}`);

  await enTanda(SOLO ? pendientesArq.slice(0, SOLO) : pendientesArq, async (a) => {
    const sub = await subtipoDe(a.image_path as string, true);
    if (sub === "error") {
      console.log(`   ✗ ${a.name}`);
      return;
    }
    // Se guarda también cuando es null: así no se vuelve a pagar por una prenda
    // que de verdad no tiene tipo fino (una playera lisa no lo necesita).
    if (!SECO) {
      await s
        .from("archetypes")
        .update({ attrs: { ...((a.attrs as Record<string, unknown>) ?? {}), subtipo: sub } })
        .eq("id", a.id);
    }
    console.log(`   ${String(a.name).padEnd(42)} ${sub ?? "(sin tipo fino)"}`);
  });

  // ── 2) Prendas con imagen propia (render, foto o prestada del catálogo) ──
  const { data: items } = await s
    .from("items")
    .select("id, attrs, render_status, render_path, photo_path")
    .is("deleted_at", null)
    .is("archetype_id", null);

  const pendientesItem = (items ?? []).filter(
    (i) => !(i.attrs as { subtipo?: string } | null)?.subtipo
  );
  console.log(`\nprendas propias por leer: ${pendientesItem.length}`);

  await enTanda(SOLO ? pendientesItem.slice(0, SOLO) : pendientesItem, async (it) => {
    const attrs = (it.attrs as Record<string, unknown>) ?? {};
    const privada =
      it.render_status === "done" && it.render_path
        ? (it.render_path as string)
        : (it.photo_path as string | null);
    const publica = (attrs.image_path as string | null) ?? null;
    const ruta = privada ?? publica;
    if (!ruta) return;

    const sub = await subtipoDe(ruta, !privada);
    if (sub === "error") {
      console.log(`   ✗ ${attrs.nombre ?? it.id}`);
      return;
    }
    if (!SECO) {
      await s.from("items").update({ attrs: { ...attrs, subtipo: sub } }).eq("id", it.id);
    }
    console.log(`   ${String(attrs.nombre ?? it.id).slice(0, 42).padEnd(42)} ${sub ?? "(sin tipo fino)"}`);
  });

  console.log(
    `\nlisto · ${leidas} lecturas · ${fallos} fallos · $${gastado.toFixed(4)} gastados`
  );
}

main();
