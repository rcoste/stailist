// PRUEBA DE ESCENAS DEL TRY-ON (2026-09-16), de laboratorio y de un solo uso.
//
// Para looks que YA tienen try-on: baja la imagen vieja (pared gris) y genera
// la nueva con lib/tryon.ts —el mismo núcleo de producción— y la escena que
// le tocaría por su plan/ocasión. Escribe en una ruta de laboratorio del
// bucket, la baja y la BORRA: no toca outfits.tryon_path ni las cuotas
// (tarea: null). Deja los pares en la carpeta que se le pase.
//
// Uso: npx tsx scripts/prueba-escenas-tryon.ts <userId> <carpeta> <outfitId>...
//      BARRIOS=polanco,roma CIUDAD=CDMX … <un outfitId>  → una imagen por barrio
//      Cada outfitId acepta "id|plan|ciudad" para simular un plan o una ciudad.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { generarTryon } from "@/lib/tryon";
import { elegirEscena } from "@/lib/tryon-escena";

const [userId, carpeta, ...ids] = process.argv.slice(2);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function bajar(path: string, destino: string) {
  const { data, error } = await supabase.storage.from("prendas").download(path);
  if (error || !data) throw new Error(`no bajó ${path}: ${error?.message}`);
  writeFileSync(destino, Buffer.from(await data.arrayBuffer()));
}

async function porBarrio(id: string, ciudad: string, barrios: string[]) {
  const { data: o } = await supabase
    .from("outfits")
    .select("id, item_ids, tip, occasion, plan, weather, title")
    .eq("id", id)
    .single();
  if (!o) return console.log(`${id}: no existe`);
  await Promise.all(
    barrios.map(async (barrio) => {
      const ctx = { plan: o.plan, ocasion: o.occasion, ciudad, barrio, semilla: id };
      const lab = `${userId}/tryons-lab/barrio-${barrio}-${id}.jpg`;
      const r = await generarTryon({
        supabase, userId, itemIds: o.item_ids, tip: o.tip, cachePath: lab,
        origin: "https://stailist.co", tarea: null, escena: ctx,
      });
      if ("error" in r) return console.log(`${barrio}: ERROR ${r.error} ${r.detalle ?? ""}`);
      await bajar(lab, `${carpeta}/barrio-${barrio}.jpg`);
      await supabase.storage.from("prendas").remove([lab]);
      console.log(`${barrio} | escena=${elegirEscena(ctx)}`);
    })
  );
}

async function main() {
  if (process.env.BARRIOS) return porBarrio(ids[0], process.env.CIUDAD ?? "CDMX", process.env.BARRIOS.split(","));
 await Promise.all(
  ids.map(async (arg) => {
    const [id, planForzado, ciudadForzada] = arg.split("|");
    const { data: o } = await supabase
      .from("outfits")
      .select("id, item_ids, tip, tryon_path, occasion, plan, weather, title")
      .eq("id", id)
      .single();
    if (!o) return console.log(`${id}: no existe`);
    if (o.tryon_path) await bajar(o.tryon_path, `${carpeta}/${id}-antes.jpg`);
    const ctx = {
      plan: planForzado || o.plan,
      ocasion: o.occasion,
      clima: o.weather,
      ciudad: ciudadForzada || null,
      semilla: id,
    };
    const lab = `${userId}/tryons-lab/escena-${id}.jpg`;
    const r = await generarTryon({
      supabase,
      userId,
      itemIds: o.item_ids,
      tip: o.tip,
      cachePath: lab,
      origin: "https://stailist.co",
      tarea: null,
      escena: ctx,
    });
    if ("error" in r) return console.log(`${id}: ERROR ${r.error} ${r.detalle ?? ""}`);
    await bajar(lab, `${carpeta}/${id}-despues.jpg`);
    await supabase.storage.from("prendas").remove([lab]);
    console.log(`${id} | ${o.title} | escena=${elegirEscena(ctx)} | plan=${ctx.plan ?? "-"} | ciudad=${ctx.ciudad ?? "-"} | clima=${o.weather?.condition ?? "-"}`);
  })
);
}

main();
