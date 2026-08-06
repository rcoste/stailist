// Dejar una corrida ya generada para que solo haya que llegar a votar.
//
// Uso:  npx tsx scripts/correr-vistazo.ts <retador> [correo] [tamaño] [nPares] [regla]
//   ej: npx tsx scripts/correr-vistazo.ts gemini-flash roberto@kublau.com
//   ej: npx tsx scripts/correr-vistazo.ts gemini-flash roberto@kublau.com veredicto 20 "si no gana con p<0.05, se queda Opus"
//
// Corre el MISMO camino que la pantalla: crea la corrida con los helpers
// compartidos (briefsPara, nRepetidos, variantePorClave) y genera cada lado
// con generarLadoYGuardar, el mismo archivo que llama la ruta admin. Lo único
// propio del script es el cliente de servicio y el ritmo secuencial.
//
// CUESTA DINERO REAL (~$2-3 por vistazo de 6 pares). Imprime el gasto al final.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  briefsPara,
  nRepetidos,
  variantePorClave,
  POOL_VERSION,
} from "../lib/comparador/motor";
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
  const tamano = process.argv[4] === "veredicto" ? "veredicto" : "vistazo";
  const nPares = tamano === "veredicto" ? Number(process.argv[5] ?? 20) : 6;
  const regla = process.argv[6] ?? "";
  if (tamano === "veredicto" && !regla.trim()) {
    console.error("Un veredicto EXIGE su regla pre-registrada como 6º argumento.");
    process.exit(1);
  }
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
  console.log(
    `${tamano === "veredicto" ? "VEREDICTO" : "Vistazo"}: ${control.etiqueta} vs ${retador.etiqueta} · ${nPares} pares · clóset de ${correo}`
  );
  if (regla) console.log(`Regla pre-registrada: ${regla}`);

  const { data: corrida, error: eCorrida } = await supabase
    .from("comparador_motor_corridas")
    .insert({
      user_id: dueno.id,
      closet_user_id: dueno.id,
      tamano,
      variantes,
      prompt_version: PROMPT_VERSION,
      pool_version: POOL_VERSION,
      regla: regla.trim() || null,
    })
    .select("id")
    .single();
  if (eCorrida || !corrida) {
    console.error("No se pudo crear la corrida:", eCorrida?.message);
    process.exit(1);
  }
  const corridaId = corrida.id as string;

  const briefs = briefsPara(tamano, nPares);
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
  // Los espejos: repiten un par con el orden invertido y SIN volver a generar.
  // Miden si el voto sobrevive a voltear las columnas.
  const reps = nRepetidos(tamano, nPares);
  if (reps > 0) {
    const ordenados = [...pares].sort((a, b) => (a.n as number) - (b.n as number));
    const espejos = Array.from({ length: reps }, (_, k) => {
      const original = ordenados[Math.floor(((k + 0.5) * nPares) / reps)];
      return {
        corrida_id: corridaId,
        n: nPares + k + 1,
        brief: briefs[(original.n as number) - 1],
        repite_de: original.id,
      };
    });
    const { error: eEspejos } = await supabase
      .from("comparador_motor_pares")
      .insert(espejos);
    if (eEspejos) {
      await supabase.from("comparador_motor_corridas").delete().eq("id", corridaId);
      console.error("No se pudieron crear los espejos:", eEspejos.message);
      process.exit(1);
    }
    console.log(`  (+${reps} pares espejo, sin costo)`);
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
