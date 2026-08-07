// CONGELAR la versión vigente del prompt, para poder correrla después.
//
// Uso:  npx tsx scripts/prompt-congelar.ts [correo] [--nota "texto"]
//
// POR QUÉ EXISTE, y por qué no se puede posponer. Roberto: "eventualmente
// tenemos que guardar los códigos para cuando saquemos la 49 y así comparar…
// como los frontier labs, ver si sale mejor el 48 contra el 49".
//
// El prompt vive en el CÓDIGO, y dos versiones no se pueden cargar a la vez en
// el mismo proceso. Cuando el repo vaya en v49, v48 seguirá en un commit de git
// pero ya no habrá forma de EJECUTARLA junto a la nueva para compararlas.
// Congelarla el día que está viva es trivial; reconstruirla después es
// arqueología — y este script existe para que ese día no llegue nunca.
//
// QUÉ GUARDA: el `system` (estático) y el mensaje de usuario YA RENDERIZADO
// para cada brief del pool. El schema se reconstruye del clóset al correr, así
// que la llamada queda reproducible exactamente.
//
// EL CLÓSET BARAJEADO ES EL DETALLE FINO: orderClosetForEngine baraja en cada
// llamada (anti sesgo posicional). El congelado captura UN barajeo concreto, y
// eso es lo correcto para comparar: las dos versiones verán EL MISMO orden y la
// diferencia no podrá venir de ahí.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "../lib/engine/contexto";
import { buildUserMessage, SYSTEM_PROMPT, PROMPT_VERSION } from "../lib/engine/prompt";
import { briefsPara, peticionDeBrief, POOL_VERSION, N_POOL } from "../lib/comparador/motor";
import { MODELO_MOTOR } from "../lib/models";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

async function main() {
  const args = process.argv.slice(2);
  const correo = args.find((a) => a.includes("@")) ?? "roberto@kublau.com";
  const iNota = args.indexOf("--nota");
  const nota = iNota >= 0 ? (args[iNota + 1] ?? null) : null;

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: perfil } = await s.from("profiles").select("id").eq("email", correo).single();
  if (!perfil) throw new Error(`sin perfil para ${correo}`);
  const userId = perfil.id as string;

  const carga = await cargarBaseDelMotor(s as never, userId);
  if ("error" in carga) throw new Error("closet_vacio");

  // El pool completo: una vuelta. Son los mismos días que resuelve el eval y el
  // comparador, así que el congelado se puede comparar contra ellos.
  const briefs = briefsPara("veredicto", N_POOL).map((brief) => {
    const ctx = construirContexto(carga.base, peticionDeBrief(brief));
    return { etiqueta: brief.etiqueta, brief, texto: buildUserMessage(ctx) };
  });

  const { error } = await s.from("prompts_congelados").upsert(
    {
      version: PROMPT_VERSION,
      pool_version: POOL_VERSION,
      closet_user_id: userId,
      modelo: MODELO_MOTOR.id,
      system: SYSTEM_PROMPT,
      briefs,
      nota,
    },
    { onConflict: "version,closet_user_id,pool_version" }
  );
  if (error) throw error;

  const kb = Math.round(
    (SYSTEM_PROMPT.length + briefs.reduce((a, b) => a + b.texto.length, 0)) / 1024
  );
  console.log(`Congelado ${PROMPT_VERSION} · pool ${POOL_VERSION} · ${MODELO_MOTOR.id}`);
  console.log(`  ${briefs.length} briefs · ${kb} KB · clóset de ${correo}`);
  console.log(`\nA partir de ahora, ${PROMPT_VERSION} se puede correr aunque el código avance.`);
}

main();
