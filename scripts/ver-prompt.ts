// Ver EXACTAMENTE qué recibe el motor, y qué pesa cada parte.
//
// Uso:  npx tsx scripts/ver-prompt.ts [correo] [brief]
//   ej: npx tsx scripts/ver-prompt.ts roberto@kublau.com "diario · lluvia"
//
// Nace de Roberto: "cuando veo lo que está, es como una caja negra; detectar
// errores ahí es imposible". No cuesta un centavo — arma el prompt con el
// MISMO código que la generación real y lo imprime, sin llamar a nadie.
//
// El desglose por bloque es la parte útil para decidir dónde recortar: cada
// llamada del juez vuelve a mandar el contexto y el clóset, así que lo que
// pese aquí se paga CUATRO veces por generación.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "../lib/engine/contexto";
import {
  buildUserMessage,
  contextBlock,
  closetBlock,
  recetasDelContexto,
  SYSTEM_PROMPT,
  PROMPT_VERSION,
} from "../lib/engine/prompt";
import { briefsPara } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

// Aproximación de tokens buena para decidir dónde recortar (no para facturar):
// ~4 caracteres por token en español.
const tok = (s: string) => Math.round(s.length / 4);

async function main() {
  const correo = process.argv[2] ?? "roberto@kublau.com";
  const etiquetaBrief = process.argv[3];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: usuarios } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const dueno = usuarios?.users.find((u) => u.email === correo);
  if (!dueno) {
    console.error(`No encontré a ${correo}.`);
    process.exit(1);
  }

  const carga = await cargarBaseDelMotor(supabase, dueno.id);
  if ("error" in carga) {
    console.error("closet_vacio");
    process.exit(1);
  }

  const briefs = briefsPara("vistazo", 6);
  const brief =
    (etiquetaBrief && briefs.find((b) => b.etiqueta === etiquetaBrief)) || briefs[0];

  const ctx = construirContexto(carga.base, {
    objective: brief.objective,
    momento: brief.momento,
    weather: brief.weather,
  });

  const mensaje = buildUserMessage(ctx);
  const bloqueContexto = contextBlock(ctx).join("\n");
  const bloqueCloset = closetBlock(ctx.items, recetasDelContexto(ctx)).join("\n");

  console.log("=".repeat(72));
  console.log(`PROMPT DEL MOTOR · ${PROMPT_VERSION} · brief: ${brief.etiqueta}`);
  console.log(`clóset: ${ctx.items.length} prendas · ${correo}`);
  console.log("=".repeat(72));
  console.log("\n----- SYSTEM (las reglas, iguales para todos) -----\n");
  console.log(SYSTEM_PROMPT);
  console.log("\n----- USER (tu contexto + tu clóset) -----\n");
  console.log(mensaje);

  const otros = tok(mensaje) - tok(bloqueContexto) - tok(bloqueCloset);
  console.log("\n" + "=".repeat(72));
  console.log("QUÉ PESA CADA BLOQUE (aprox., ~4 caracteres = 1 token)");
  console.log("=".repeat(72));
  const filas: [string, number][] = [
    ["system (reglas de styling)", tok(SYSTEM_PROMPT)],
    ["tu contexto (colorimetría, gustos, vetos, feedback…)", tok(bloqueContexto)],
    ["tu clóset (las 113 prendas con su descripción)", tok(bloqueCloset)],
    ["lo demás (blueprint, rotación, combos recientes…)", otros],
  ];
  const total = filas.reduce((a, [, n]) => a + n, 0);
  for (const [nombre, n] of filas) {
    const pct = Math.round((n / total) * 100);
    console.log(`  ${String(n).padStart(6)} tok  ${String(pct).padStart(3)}%  ${nombre}`);
  }
  console.log(`  ${String(total).padStart(6)} tok  100%  TOTAL por llamada`);
  console.log(
    `\nY esto viaja 4 VECES por generación (1 generador + 3 jueces):\n  ~${total * 4} tokens de entrada.`
  );
}

main();
