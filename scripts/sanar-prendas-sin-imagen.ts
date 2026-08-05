// Genera el render limpio de las prendas que quedaron SIN NINGUNA imagen.
//
// POR QUÉ EXISTE
// El clóset tiene cuatro formas de conseguir la imagen de una prenda: foto
// propia, arquetipo, render limpio propio, o una imagen PRESTADA de un arquetipo
// parecido. "Camisa de lino esmeralda" no tiene ninguna de las cuatro, y salía
// en el A/B como "sin foto" — y peor: el try-on, al no recibir su imagen, dejaba
// puesta la playera blanca base del avatar. Roberto lo cachó mirando el render.
//
// Prestar dejó de funcionar A PROPÓSITO: antes le prestaba la foto del "Suéter
// esmeralda" (#1E6B52 contra #1F6B4A, casi el mismo color) y salía un suéter
// donde el outfit decía camisa. El arreglo exige mismo TIPO de prenda, no solo
// color parecido — correcto, pero deja a la camisa sin nada que pedir prestado:
// la única camisa verde del catálogo es turquesa, a 128 de distancia cuando el
// tope es 40.
//
// El render propio ya existía (lib/render-item, el mismo del auto-sanado), pero
// solo se dispara desde el navegador — en Hoy automático y en maleta al tocar.
// El arnés del A/B no pasa por ahí, así que la prenda nunca se sanó.
//
// Uso: npx tsx scripts/sanar-prendas-sin-imagen.ts [--aplicar]
//      sin --aplicar solo lista qué prendas sanaría.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { renderItemImage } from "../lib/render-item";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l
      .slice(i + 1)
      .trim()
      .replace(/^"|"$/g, "");
  }
}

const APLICAR = process.argv.includes("--aplicar");

type Fila = {
  id: string;
  user_id: string;
  photo_path: string | null;
  render_status: string | null;
  render_path: string | null;
  attrs: { nombre?: string; categoria?: string; image_path?: string | null } | null;
  archetype_id: string | null;
  archetypes: { image_path?: string | null } | null;
};

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Todas las prendas vivas, paginadas: Supabase corta en 1000 por consulta y
  // hay 967 — a un par de altas de romper el conteo en silencio.
  const todas: Fila[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data } = await s
      .from("items")
      .select(
        "id, user_id, photo_path, render_status, render_path, attrs, archetype_id, archetypes(image_path)"
      )
      .is("deleted_at", null)
      .range(desde, desde + 999);
    if (!data?.length) break;
    todas.push(...(data as unknown as Fila[]));
    if (data.length < 1000) break;
  }

  const sin = todas.filter(
    (i) =>
      !i.photo_path &&
      !(i.render_status === "done" && i.render_path) &&
      !i.attrs?.image_path &&
      !i.archetypes?.image_path
  );

  console.log(
    `${todas.length} prendas vivas · ${sin.length} sin ninguna imagen${APLICAR ? "" : " (simulación)"}\n`
  );
  if (!sin.length) return;

  let ok = 0;
  for (const it of sin) {
    const nombre = it.attrs?.nombre ?? it.id;
    if (!APLICAR) {
      console.log(`  · ${nombre}  [${it.attrs?.categoria ?? "?"}]`);
      continue;
    }
    // De uno en uno: cada render es una llamada de generación de imagen y el
    // guard anti doble-generación marca 'pending' en la fila. En paralelo se
    // pisarían y no vale la pena por ocho prendas.
    const r = await renderItemImage(s, it.user_id, it.id);
    if (r.ok && r.path) {
      ok++;
      console.log(`  ✓ ${nombre}`);
    } else {
      console.log(`  ✗ ${nombre} — ${r.skipped ? "omitida" : (r.error ?? "falló")}`);
    }
  }
  if (APLICAR) console.log(`\n${ok}/${sin.length} sanadas`);
}

main();
