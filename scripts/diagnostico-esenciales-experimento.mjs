// Diagnóstico READ-ONLY, dos preguntas de una sentada (2026-08-13):
//
//   1. BACKFILL: ¿a cuántas personas les quedó la palabra "cápsula" en el
//      texto que LEEN (firma / subline / pilares / resumen de sus esenciales,
//      y lo mismo en la firma de cada viaje)? Ver v0.2.236.0: el prompt ya no
//      la escribe, pero lo generado antes la conserva.
//   2. EXPERIMENTO: quién usa esto de verdad — última actividad, si tienen
//      esenciales/looks, y la señal de oro (fit checks con foto).
//
// No escribe NADA. `node scripts/diagnostico-esenciales-experimento.mjs`

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();

const p = (t) => console.log(t);

// ---- 1. La palabra "cápsula" en texto que lee la persona --------------------
p("\n═══ 1. BACKFILL: ¿dónde quedó escrita la palabra \"cápsula\"? ═══\n");

const esenciales = await client.query(`
  select
    count(*) filter (where capsule_target is not null) as con_lista,
    count(*) filter (where capsule_target::text ilike '%cápsula%' or capsule_target::text ilike '%capsula%') as con_palabra
  from profiles
`);
p(`Perfiles con lista de esenciales: ${esenciales.rows[0].con_lista}`);
p(`  …de esos, con la palabra en su texto: ${esenciales.rows[0].con_palabra}`);

const campos = await client.query(`
  select
    count(*) filter (where capsule_target->>'firma' ilike '%psula%') as en_firma,
    count(*) filter (where capsule_target->>'subline' ilike '%psula%') as en_subline,
    count(*) filter (where capsule_target->>'resumen' ilike '%psula%') as en_resumen,
    count(*) filter (where capsule_target->>'pilares' ilike '%psula%') as en_pilares
  from profiles where capsule_target is not null
`);
p(`  desglose → firma: ${campos.rows[0].en_firma} · subline: ${campos.rows[0].en_subline} · resumen: ${campos.rows[0].en_resumen} · pilares: ${campos.rows[0].en_pilares}`);

const viajes = await client.query(`
  select count(*) as n from trips
  where deleted_at is null and capsule_target->>'firma' ilike '%psula%'
`);
p(`Viajes con la palabra en su firma: ${viajes.rows[0].n}`);

const muestras = await client.query(`
  select capsule_target->>'subline' as t from profiles
  where capsule_target->>'subline' ilike '%psula%' limit 4
`);
p("\n  Muestras de cómo se lee hoy:");
muestras.rows.forEach((r) => p(`   · "${r.t}"`));

// ---- 2. El experimento -----------------------------------------------------
p("\n\n═══ 2. EXPERIMENTO: quién usa esto de verdad ═══\n");

const universo = await client.query(`
  select
    (select count(*) from allowlist) as invitados,
    (select count(*) from profiles) as perfiles,
    (select count(*) from profiles where capsule_target is not null) as con_lista
`);
p(`Invitados en la allowlist: ${universo.rows[0].invitados} · perfiles creados: ${universo.rows[0].perfiles} · con lista: ${universo.rows[0].con_lista}`);

const actividad = await client.query(`
  select
    p.email,
    (p.capsule_target is not null) as tiene_esenciales,
    (select count(*) from items i where i.user_id = p.id and i.deleted_at is null) as prendas,
    (select count(*) from outfits o where o.user_id = p.id and o.deleted_at is null) as looks,
    (select max(e.created_at) from events e where e.user_id = p.id) as ultima_actividad,
    (select count(*) from events e where e.user_id = p.id and e.created_at > now() - interval '7 days') as eventos_7d
  from profiles p
  order by (select max(e.created_at) from events e where e.user_id = p.id) desc nulls last
  limit 25
`);
p("\n  email                              prendas  looks  esenc  últ.actividad        7d");
for (const r of actividad.rows) {
  const em = (r.email ?? "—").slice(0, 34).padEnd(34);
  const ult = r.ultima_actividad ? new Date(r.ultima_actividad).toISOString().slice(0, 16).replace("T", " ") : "nunca";
  p(`  ${em} ${String(r.prendas).padStart(6)} ${String(r.looks).padStart(6)}  ${r.tiene_esenciales ? " sí " : " no "}  ${ult.padEnd(18)} ${String(r.eventos_7d).padStart(3)}`);
}

const tipos = await client.query(`
  select type, count(*) as n, max(created_at) as ultimo
  from events where created_at > now() - interval '14 days'
  group by type order by n desc limit 12
`);
p("\n  Eventos de los últimos 14 días:");
tipos.rows.forEach((r) =>
  p(`   · ${String(r.type).padEnd(24)} ${String(r.n).padStart(4)}   último: ${new Date(r.ultimo).toISOString().slice(0, 16).replace("T", " ")}`)
);

const votos = await client.query(`
  select
    count(*) filter (where type = 'outfit_vote') as votos,
    count(*) filter (where type = 'fit_check') as fit_checks,
    count(*) filter (where type = 'worn') as worn
  from events where created_at > now() - interval '30 days'
`);
p(`\n  Últimos 30 días → votos: ${votos.rows[0].votos} · fit checks: ${votos.rows[0].fit_checks} · "me lo puse": ${votos.rows[0].worn}`);

await client.end();
p("");
