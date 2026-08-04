// Quita las imágenes prestadas que apuntan a OTRA prenda.
//
// POR QUÉ
// borrowArchetypeImage emparejaba por palabras sueltas del nombre y su lista de
// colores a ignorar no incluía "esmeralda" (ni turquesa, coral, salvia,
// burdeos…). Resultado: "Camisa de lino esmeralda" se quedó con la foto de un
// "Suéter esmeralda". No es cosmético — el try-on genera el look con la prenda
// equivocada y el motor cree que hay una camisa de lino fresca donde hay un
// suéter de lana. Lo cazó Roberto en un look para 30°C.
//
// El código ya está arreglado (lista blanca de tipos), pero las prendas que YA
// quedaron mal siguen mal: esto las revisa con el criterio nuevo y le quita la
// imagen a las que no cuadran. Sin imagen prestada, la app cae al render limpio
// de la prenda real — que es lo correcto.
//
// Uso: npx tsx scripts/limpiar-imagenes-prestadas.ts [--aplicar]
//      (sin --aplicar solo reporta: nunca borra sin que se lo pidan)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { tipoDePrenda } from "../lib/engine/vocabulario";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}

const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  // Solo las que tienen imagen PRESTADA y ninguna propia: si hay foto o render,
  // la prestada ni se usa (ver el orden de pickItemImage).
  const { data: items } = await s
    .from("items")
    .select("id, user_id, attrs, photo_path, render_status, render_path")
    .is("deleted_at", null)
    .is("archetype_id", null);

  const { data: arqs } = await s.from("archetypes").select("name, image_path");
  const nombrePorImagen = new Map(
    (arqs ?? []).map((a) => [a.image_path as string, a.name as string])
  );

  const malas: { id: string; prenda: string; muestra: string }[] = [];
  for (const it of items ?? []) {
    const attrs = (it.attrs ?? {}) as { nombre?: string; image_path?: string };
    if (!attrs.image_path) continue;
    const prestadaDe = nombrePorImagen.get(attrs.image_path);
    if (!prestadaDe) continue;
    const mio = tipoDePrenda(attrs.nombre ?? "")?.tipo ?? null;
    const suyo = tipoDePrenda(prestadaDe)?.tipo ?? null;
    // Si alguno no se reconoce, NO se toca: un falso positivo aquí le quita la
    // imagen a una prenda que estaba bien.
    if (!mio || !suyo || mio === suyo) continue;
    malas.push({ id: it.id as string, prenda: attrs.nombre ?? "?", muestra: prestadaDe });
  }

  console.log(`${malas.length} prendas muestran la foto de otra cosa:\n`);
  for (const m of malas) console.log(`  "${m.prenda}"  →  muestra "${m.muestra}"`);

  if (!APLICAR) {
    console.log(`\n(nada modificado — corre con --aplicar para quitarles la imagen)`);
    return;
  }
  let ok = 0;
  for (const m of malas) {
    const { data: row } = await s.from("items").select("attrs").eq("id", m.id).single();
    const attrs = { ...((row?.attrs ?? {}) as Record<string, unknown>) };
    delete attrs.image_path;
    const { error } = await s.from("items").update({ attrs }).eq("id", m.id);
    if (!error) ok++;
  }
  console.log(`\n${ok}/${malas.length} corregidas. Ahora caen al render limpio de la prenda real.`);
}

main();
