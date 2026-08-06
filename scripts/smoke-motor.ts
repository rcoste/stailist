// Smoke del pipeline compartido del motor: UNA corrida real (generar + jueces)
// sobre el clóset de Roberto, por el MISMO camino que producción y el
// comparador (contexto.ts → pipeline.ts → proveedores). No escribe nada en la
// base — solo lee e imprime looks y recibo.
//
// Uso:  npx tsx scripts/smoke-motor.ts            (variante producción)
//       npx tsx scripts/smoke-motor.ts sonnet     (una clave de VARIANTES_MOTOR)
//
// CUESTA dinero real (~$0.20 con Opus): es para verificar un refactor del
// motor de punta a punta, no para correrlo por deporte.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "../lib/engine/contexto";
import { armarLooks } from "../lib/engine/pipeline";
import { variantePorClave, briefsPara, opcionesDeVariante } from "../lib/comparador/motor";
import { modeloPorId } from "../lib/proveedores/catalogo";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const clave = process.argv[2] ?? "produccion";
  const variante = variantePorClave(clave);
  if (!variante) {
    console.error(`No existe la variante "${clave}".`);
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: admin } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true)
    .order("created_at")
    .limit(1)
    .single();
  if (!admin) {
    console.error("No hay admin en profiles.");
    process.exit(1);
  }

  const carga = await cargarBaseDelMotor(supabase, admin.id);
  if ("error" in carga) {
    console.error("closet_vacio");
    process.exit(1);
  }
  console.log(
    `Clóset: ${carga.base.items.length} prendas · variante: ${variante.etiqueta}`
  );

  const brief = briefsPara("vistazo", 6)[0];
  const ctx = construirContexto(carga.base, {
    objective: brief.objective,
    momento: brief.momento,
    weather: brief.weather,
  });

  const t0 = Date.now();
  // El MISMO traductor variante→opciones que usa la ruta de generación.
  const opciones = opcionesDeVariante(variante, modeloPorId);
  if (!opciones) {
    console.error(`El modelo de "${clave}" ya no está en el catálogo.`);
    process.exit(1);
  }
  const { finalized, reviews, recibos } = await armarLooks(ctx, opciones);

  const nombre = new Map(
    carga.base.items.map((i) => [i.id, i.attrs.nombre ?? i.attrs.tipo])
  );
  console.log(`\n${finalized.length} looks en ${Math.round((Date.now() - t0) / 1000)}s:`);
  for (const o of finalized) {
    console.log(`  · "${o.nombre}": ${o.item_ids.map((id) => nombre.get(id)).join(" + ")}`);
    console.log(`    ${o.explicacion}`);
  }
  console.log(`\nVeredictos del juez: ${reviews.map((r) => r.verdict).join(", ")}`);
  const costo = recibos.reduce((a, r) => a + (r.costoUsd ?? 0), 0);
  const tokens = recibos.reduce((a, r) => a + r.tokens.entrada + r.tokens.salida, 0);
  console.log(`Recibo: ${recibos.length} llamadas · ${tokens} tokens · $${costo.toFixed(4)}`);
}

main();
