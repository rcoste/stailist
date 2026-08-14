// Saca la palabra "cápsula" del texto YA GENERADO que lee la persona.
//
// Contexto: v0.2.236.0 corrigió el prompt (el motor ya no la escribe), pero lo
// generado antes la conserva. Corrió el 2026-08-13 sobre prod: 14 sublines de
// profiles.capsule_target, 3 `porque` de prendas sueltas y la firma de 1 viaje.
// Quedó en cero. Se conserva por si reaparece (y como plantilla del patrón).
//
// LECCIÓN del que lo corra de nuevo: la primera pasada creyó que la palabra
// vivía SOLO en `subline` porque eso dijo el desglose por campo — y se quedaron
// 3 escondidas en `items[].porque`, que también se lee (sale debajo de cada
// pieza). Verificar con `capsule_target::text ~* 'psula'` sobre el JSON ENTERO,
// no campo por campo.
//
// NO regenera nada: es reemplazo de texto. Regenerar borraría la lista de cada
// quien y sus decisiones — el costo no se parece al beneficio de una palabra.
//
// Uso (desde la raíz del repo):
//   node scripts/backfill-palabra-capsula.mjs           → dry-run (no escribe)
//   node scripts/backfill-palabra-capsula.mjs --apply   → escribe
//
// Seguridad:
// - Escribe con jsonb_set por ruta (`{subline}`, `{items,N,porque}`, `{firma}`):
//   el resto del target (items, pilares, styleSig) queda intacto.
// - Cada regla es una frase completa, no la palabra suelta, para que la
//   gramática cierre ("tu cápsula" → "tus esenciales", femenino a plural).
// - Lo que no case con ninguna regla NO se toca: se imprime para revisarlo a
//   mano. Nada se transforma en silencio.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

const env = Object.fromEntries(
  readFileSync(path.join(REPO_ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
);
if (!env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env.local");
  process.exit(1);
}

// DOS juegos de reglas, porque la palabra no significa lo mismo en cada lado:
//
//   · PERFIL  → la lista se llama "tus esenciales". Cambia de femenino
//     singular a masculino plural, así que solo se aplica sobre patrones
//     donde el verbo NO concuerda con el objeto ("Armé tu cápsula…": "armé"
//     es primera persona y no se entera del cambio). Cualquier otra forma se
//     manda a revisión manual en vez de arriesgar una concordancia rota.
//   · VIAJE   → ahí la cápsula ES la maleta, no "tus esenciales". Y "maleta"
//     es femenino singular igual que "cápsula", así que el resto de la frase
//     ("Tu cápsula gira sobre…") sigue concordando sin tocar nada más.
//
// Esto salió del dry-run: la regla única convertía "Tu cápsula gira" en "tus
// esenciales gira" — sin mayúscula y con el verbo en singular colgando.
const REGLAS_PERFIL = [
  [/\bArmé\s+tu\s+c[áa]psula\b/g, "Armé tus esenciales"],
  [/\barmé\s+tu\s+c[áa]psula\b/g, "armé tus esenciales"],
  [/\bcl[óo]sets?\s+c[áa]psulas?\b/gi, "esenciales"],
];
const REGLAS_VIAJE = [
  [/\bC[áa]psulas?\b/g, "Maleta"],
  [/\bc[áa]psulas?\b/g, "maleta"],
];
// El "por qué" de cada prenda (items[].porque) TAMBIÉN lo lee la persona: sale
// debajo de la pieza en la lista. Aquí la palabra aparece como complemento
// ("cada top de la cápsula", "el eje de la cápsula"), así que la regla es sobre
// la frase completa y el resto de la oración no se entera del cambio.
const REGLAS_PORQUE = [
  [/\bde la c[áa]psula\b/gi, "de tus esenciales"],
  [/\bla c[áa]psula\b/gi, "tus esenciales"],
  [/\btu c[áa]psula\b/gi, "tus esenciales"],
];
const TIENE = /c[áa]psulas?/i;

function corregir(texto, reglas) {
  if (!texto || !TIENE.test(texto)) return null;
  let out = texto;
  for (const [re, rep] of reglas) out = out.replace(re, rep);
  // Si algo de la palabra sobrevivió, ninguna regla la cubrió limpio: se
  // reporta y NO se escribe. Nada se transforma en silencio.
  if (TIENE.test(out)) return { texto: out, residuo: true };
  return { texto: out, residuo: false };
}

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

console.log(`\n${APPLY ? "APLICANDO" : "DRY-RUN (no escribe nada)"}\n`);

// ---- Perfiles: capsule_target.subline --------------------------------------
const perfiles = await client.query(`
  select id, email, capsule_target->>'subline' as subline
  from profiles
  where capsule_target->>'subline' ~* 'c[áa]psula'
  order by email
`);

let okP = 0;
const residuos = [];
console.log(`── Perfiles a corregir: ${perfiles.rows.length}\n`);
for (const r of perfiles.rows) {
  const fix = corregir(r.subline, REGLAS_PERFIL);
  if (!fix) continue;
  if (fix.residuo) {
    residuos.push({ tipo: "perfil", email: r.email, antes: r.subline, despues: fix.texto });
    continue;
  }
  console.log(`  ${(r.email ?? "—").slice(0, 30)}`);
  console.log(`    antes:   ${r.subline}`);
  console.log(`    después: ${fix.texto}\n`);
  if (APPLY) {
    await client.query(
      `update profiles set capsule_target = jsonb_set(capsule_target, '{subline}', to_jsonb($1::text)) where id = $2`,
      [fix.texto, r.id]
    );
  }
  okP++;
}

// ---- Perfiles: capsule_target.items[].porque -------------------------------
const conItems = await client.query(`
  select id, email, capsule_target->'items' as items
  from profiles
  where capsule_target::text ~* 'c[áa]psula'
  order by email
`);
let okI = 0;
console.log(`── Prendas con la palabra en su "por qué":\n`);
for (const r of conItems.rows) {
  const items = Array.isArray(r.items) ? r.items : [];
  for (let i = 0; i < items.length; i++) {
    const fix = corregir(items[i]?.porque, REGLAS_PORQUE);
    if (!fix) continue;
    if (fix.residuo) {
      residuos.push({ tipo: "prenda", email: r.email, antes: items[i].porque, despues: fix.texto });
      continue;
    }
    console.log(`  ${(r.email ?? "—").slice(0, 30)} · prenda ${i} (${items[i].nombre ?? "?"})`);
    console.log(`    antes:   ${items[i].porque}`);
    console.log(`    después: ${fix.texto}\n`);
    if (APPLY) {
      // Ruta quirúrgica: solo ese `porque`, el resto del target intacto.
      await client.query(
        `update profiles set capsule_target = jsonb_set(capsule_target, $1::text[], to_jsonb($2::text)) where id = $3`,
        [`{items,${i},porque}`, fix.texto, r.id]
      );
    }
    okI++;
  }
}

// ---- Viajes: capsule_target.firma ------------------------------------------
const viajes = await client.query(`
  select id, lugar, capsule_target->>'firma' as firma
  from trips
  where deleted_at is null and capsule_target->>'firma' ~* 'c[áa]psula'
`);
let okV = 0;
console.log(`── Viajes a corregir: ${viajes.rows.length}\n`);
for (const r of viajes.rows) {
  const fix = corregir(r.firma, REGLAS_VIAJE);
  if (!fix) continue;
  if (fix.residuo) {
    residuos.push({ tipo: "viaje", email: r.lugar, antes: r.firma, despues: fix.texto });
    continue;
  }
  console.log(`  viaje a ${r.lugar}`);
  console.log(`    antes:   ${r.firma}`);
  console.log(`    después: ${fix.texto}\n`);
  if (APPLY) {
    await client.query(
      `update trips set capsule_target = jsonb_set(capsule_target, '{firma}', to_jsonb($1::text)) where id = $2`,
      [fix.texto, r.id]
    );
  }
  okV++;
}

if (residuos.length > 0) {
  console.log(`\n⚠ ${residuos.length} textos NO se tocaron (ninguna regla los cubre limpio). Revísalos a mano:`);
  residuos.forEach((x) => console.log(`   [${x.tipo}] ${x.email}\n     "${x.antes}"`));
}

console.log(
  `\n${APPLY ? "Escrito" : "Se escribiría"}: ${okP} sublines + ${okI} "por qué" de prenda + ${okV} viajes.` +
    (residuos.length ? ` ${residuos.length} sin tocar.` : " Sin residuos.")
);
await client.end();
