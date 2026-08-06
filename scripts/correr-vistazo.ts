// Dejar un VISTAZO ya generado para que solo haya que llegar a votar.
//
// Uso:  npx tsx scripts/correr-vistazo.ts <clave-retador> [correo-del-closet]
//   ej: npx tsx scripts/correr-vistazo.ts gemini-flash roberto@kublau.com
//
// Corre el MISMO camino que la pantalla: crea la corrida con los helpers
// compartidos (briefsPara, nRepetidos, variantePorClave) y genera cada lado
// con generarLadoYGuardar, el mismo archivo que llama la ruta admin. Lo único
// propio del script es el cliente de servicio y el ritmo secuencial.
//
// CUESTA DINERO REAL (~$2-3 por vistazo de 6 pares). Imprime el gasto al final.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { briefsPara, nRepetidos, variantePorClave } from "../lib/comparador/motor";
import { generarLadoYGuardar } from "../lib/comparador/generar-lado";
import { PROMPT_VERSION } from "../lib/engine/prompt";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const claveRetador = process.argv[2];
  const correo = process.argv[3] ?? "roberto@kublau.com";
  const retador = claveRetador ? variantePorClave(claveRetador) : null;
  if (!retador || retador.clave === "produccion") {
    console.error(
      `Uso: npx tsx scripts/correr-vistazo.ts <clave-retador> [correo]\nEl retador no puede ser "produccion" (es el control).`
    );
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: usuarios } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const dueno = usuarios?.users.find((u) => u.email === correo);
  if (!dueno) {
    console.error(`No encontré al usuario ${correo}.`);
    process.exit(1);
  }
  const { data: perfil } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", dueno.id)
    .single();
  if (!perfil?.is_admin) {
    console.error(`${correo} no es admin — el comparador corre sobre su propio clóset.`);
    process.exit(1);
  }

  const control = variantePorClave("produccion")!;
  const variantes = [control, retador];
  console.log(`Vistazo: ${control.etiqueta} vs ${retador.etiqueta} · clóset de ${correo}`);

  const { data: corrida, error: eCorrida } = await supabase
    .from("comparador_motor_corridas")
    .insert({
      user_id: dueno.id,
      closet_user_id: dueno.id,
      tamano: "vistazo",
      variantes,
      prompt_version: PROMPT_VERSION,
    })
    .select("id")
    .single();
  if (eCorrida || !corrida) {
    console.error("No se pudo crear la corrida:", eCorrida?.message);
    process.exit(1);
  }
  const corridaId = corrida.id as string;

  const briefs = briefsPara("vistazo", 6);
  const { data: pares, error: ePares } = await supabase
    .from("comparador_motor_pares")
    .insert(briefs.map((brief, i) => ({ corrida_id: corridaId, n: i + 1, brief })))
    .select("id, n")
    .order("n");
  if (ePares || !pares) {
    // Sin pares la corrida es un cascarón: se borra, igual que en la pantalla.
    await supabase.from("comparador_motor_corridas").delete().eq("id", corridaId);
    console.error("No se pudieron crear los pares:", ePares?.message);
    process.exit(1);
  }
  if (nRepetidos("vistazo", 6) > 0) {
    console.warn("OJO: el vistazo ahora pide espejos y este script no los crea.");
  }

  console.log(`Corrida ${corridaId} · ${pares.length} pares · generando…\n`);

  // Secuencial a propósito: sin nadie mirando, la prisa no vale un 429 del
  // proveedor a media corrida.
  let fallos = 0;
  for (const par of pares) {
    for (const v of variantes) {
      const t0 = Date.now();
      const r = await generarLadoYGuardar({
        supabase,
        corridaId,
        parId: par.id as string,
        variante: v.clave,
        actorId: dueno.id,
      });
      const seg = Math.round((Date.now() - t0) / 1000);
      if ("error" in r) {
        fallos++;
        console.log(`  par ${par.n} · ${v.etiqueta}: ERROR ${r.error} ${r.detalle ?? ""}`);
      } else if ("fallo" in r) {
        fallos++;
        console.log(`  par ${par.n} · ${v.etiqueta}: falló (${r.fallo}) — ${seg}s`);
      } else {
        console.log(`  par ${par.n} · ${v.etiqueta}: ok — ${seg}s`);
      }
    }
  }

  const { data: lados } = await supabase
    .from("comparador_motor_lados")
    .select("variante, costo_usd")
    .eq("corrida_id", corridaId);
  const gasto = (lados ?? []).reduce((a, l) => a + Number(l.costo_usd ?? 0), 0);

  // "juzgando": lista para votar. No se cierra — cerrar sella el resultado.
  await supabase
    .from("comparador_motor_corridas")
    .update({ estado: "juzgando" })
    .eq("id", corridaId);

  console.log(`\nListo. Gastado: $${gasto.toFixed(3)} · fallos: ${fallos}`);
  console.log(`Votar en: /admin/comparador/motor/${corridaId}`);
}

main();
