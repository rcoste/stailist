// Rellena LookMotor.prendas en los lados del comparador cuyas prendas SIGUEN
// vivas. Los lados cuyas prendas ya murieron (rondas anteriores al reseteo del
// clóset del 2026-08-18) no se tocan: no hay de dónde sacar el nombre.
//
// Uso: npx tsx scripts/backfill-nombres-comparador.ts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { conNombres } from "../lib/comparador/generar-lado";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const items: { id: string; attrs: { nombre?: string | null } }[] = [];
  for (let d = 0; ; d += 1000) {
    const { data } = await s.from("items").select("id, attrs").range(d, d + 999);
    if (!data?.length) break;
    items.push(...(data as typeof items));
    if (data.length < 1000) break;
  }
  const vivos = new Set(items.map((i) => i.id));

  const { data: lados } = await s
    .from("comparador_motor_lados")
    .select("id, looks")
    .not("looks", "is", null);
  let rellenados = 0, yaTenian = 0, huerfanos = 0;
  for (const lado of lados ?? []) {
    const looks = lado.looks as { item_ids: string[]; prendas?: unknown }[];
    if (!looks?.length) continue;
    if (looks.every((l) => l.prendas)) { yaTenian++; continue; }
    const todasVivas = looks.every((l) => (l.item_ids ?? []).every((id) => vivos.has(id)));
    if (!todasVivas) { huerfanos++; continue; }
    const { error } = await s
      .from("comparador_motor_lados")
      .update({ looks: conNombres(looks, items) })
      .eq("id", lado.id);
    if (error) throw new Error(`lado ${lado.id}: ${error.message}`);
    rellenados++;
  }
  console.log(`lados rellenados: ${rellenados} · ya tenían nombres: ${yaTenian} · huérfanos (prendas muertas, sin tocar): ${huerfanos}`);
}
main();
