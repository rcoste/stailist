// Generar TODOS los lados pendientes de una corrida del comparador, sin
// pantalla.
//
// Uso:  npx tsx scripts/comparador-generar.ts <corridaId>
//
// La pantalla los pide de a bloques desde el navegador (para caber en los 60s
// de Vercel y para que cerrar la pestaña deje de gastar). Aquí no hay ninguno
// de esos dos límites, así que se corren todos de corrido — el patrón de
// siempre: la ruta pone HTTP, el script pone el cliente de servicio, y el
// trabajo real vive en lib/comparador/generar-lado.ts.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generarLadoYGuardar } from "../lib/comparador/generar-lado";
import type { VarianteMotor } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const corridaId = process.argv[2];
  if (!corridaId) {
    console.error("Uso: npx tsx scripts/comparador-generar.ts <corridaId>");
    process.exit(1);
  }
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: corrida } = await s
    .from("comparador_motor_corridas")
    .select("variantes, closet_user_id")
    .eq("id", corridaId)
    .single();
  if (!corrida) throw new Error("no existe esa corrida");
  const claves = (corrida.variantes as VarianteMotor[]).map((v) => v.clave);
  const actorId = corrida.closet_user_id as string;

  const [{ data: pares }, { data: lados }] = await Promise.all([
    s.from("comparador_motor_pares").select("id, n, repite_de").eq("corrida_id", corridaId).order("n"),
    s.from("comparador_motor_lados").select("par_id, variante").eq("corrida_id", corridaId),
  ]);
  const hechos = new Set((lados ?? []).map((l) => `${l.par_id}|${l.variante}`));

  // Los espejos no generan: heredan los looks de su original.
  const trabajos = (pares ?? [])
    .filter((p) => !p.repite_de)
    .flatMap((p) =>
      claves
        .filter((c) => !hechos.has(`${p.id}|${c}`))
        .map((variante) => ({ parId: p.id as string, variante, n: p.n as number }))
    );
  console.log(`${trabajos.length} lados por generar`);

  const cola = [...trabajos];
  let listos = 0;
  // Dos a la vez: un lado es el motor completo (25-45s) y los proveedores
  // aguantan dos; más sería apostar contra los límites de ritmo.
  const obrero = async () => {
    for (;;) {
      const t = cola.shift();
      if (!t) return;
      const t0 = Date.now();
      const r = await generarLadoYGuardar({
        supabase: s,
        corridaId,
        parId: t.parId,
        variante: t.variante,
        actorId,
      });
      const seg = Math.round((Date.now() - t0) / 1000);
      const que = "error" in r ? `ERROR ${r.error} ${r.detalle ?? ""}` : "fallo" in r ? `fallo: ${r.fallo}` : "ok";
      console.log(`  [${++listos}/${trabajos.length}] par ${t.n} · ${t.variante} — ${que} (${seg}s)`);
    }
  };
  await Promise.all(Array.from({ length: 2 }, obrero));
  console.log(`\nlisto. Ahora: npx tsx scripts/comparador-juzgar.ts ${corridaId}`);
}

main();
