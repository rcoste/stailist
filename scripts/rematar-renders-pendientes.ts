import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) {
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
}
import { createClient } from "@supabase/supabase-js";
import { renderItemImage } from "../lib/render-item";

// Remata las prendas que entraron SIN su imagen limpia por el tope del día
// (lib/renders-pendientes.ts) de UNA persona, sin esperar a que vuelva a abrir
// su clóset.
//
// CUÁNDO SE USA. La regla normal es que esas imágenes se generan cuando la
// persona regresa (components/closet-grid.tsx), para gastar sólo en quien
// vuelve. Este script es para el caso en que ya sabemos que vale la pena: alguien
// reportó "no cargan las fotos de mi clóset" y queremos que al abrir la app lo
// encuentre arreglado, no "mañana". Brinca la cuota de la persona a propósito
// —corre con la service key— y deja el recibo en ai_calls a su nombre con la
// tarea "render-prenda-remate": el gasto se ve en el admin, pero NO cuenta para
// su cupo del día. La primera corrida (2026-10-12) lo dejó como
// "render-prenda" y le comió 52 de sus 120 imágenes a quien había reportado.
//
// Uso: npx tsx scripts/rematar-renders-pendientes.ts correo@ejemplo.com [--seco] [--conc=2]

async function main() {
  const correo = process.argv[2];
  if (!correo || !correo.includes("@")) {
    console.error("uso: npx tsx scripts/rematar-renders-pendientes.ts <correo> [--seco] [--conc=2]");
    process.exit(1);
  }
  const SECO = process.argv.includes("--seco");
  const CONC = Number((process.argv.find((a) => a.startsWith("--conc=")) ?? "--conc=2").split("=")[1]);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const { data: perfil } = await supabase.from("profiles").select("id").eq("email", correo).maybeSingle();
  if (!perfil) {
    console.error(`no hay perfil con el correo ${correo}`);
    process.exit(1);
  }

  const { data: items } = await supabase
    .from("items")
    .select("id, attrs, photo_path, render_path, render_status")
    .eq("user_id", perfil.id)
    .is("deleted_at", null)
    .is("render_path", null);
  const pendientes = (items ?? []).filter((i) => (i.attrs as { render_pendiente?: boolean } | null)?.render_pendiente === true);
  console.log(`${correo}: ${pendientes.length} prendas pendientes de ${items?.length ?? 0} sin render`);
  if (SECO || pendientes.length === 0) process.exit(0);

  let ok = 0;
  let fallo = 0;
  const cola = [...pendientes];
  const obrero = async () => {
    while (cola.length) {
      const it = cola.shift()!;
      const nombre = (it.attrs as { nombre?: string }).nombre ?? it.id.slice(0, 8);
      const t0 = Date.now();
      const r = await renderItemImage(supabase, perfil.id, it.id, false, true, "render-prenda-remate");
      const s = ((Date.now() - t0) / 1000).toFixed(1);
      if (r.ok && r.path) {
        ok++;
        console.log(`  ✓ ${nombre} (${s}s)`);
      } else {
        fallo++;
        console.log(`  ✗ ${nombre}: ${r.error ?? (r.skipped ? "saltada" : "?")} (${s}s)`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONC }, obrero));
  console.log(`listo: ${ok} con imagen, ${fallo} fallaron o se saltaron`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
