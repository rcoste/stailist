// Resetea un usuario de PRUEBA a estado 0 para re-correr el onboarding completo
// desde cero (género → edad → swipes → colorimetría → clóset → objetivo → wow).
//
// Uso (desde la raíz del repo):
//   node scripts/reset-test-user.mjs                      # resetea roberto.dev
//   node scripts/reset-test-user.mjs claude.dev@stailist.app
//
// CANDADO DE SEGURIDAD: solo corre sobre correos de prueba conocidos. Jamás
// puede tocar a un usuario real (Tatiana/Toño/etc.) aunque te equivoques de
// argumento. El DATABASE_URL local apunta a prod, así que esto SÍ escribe en la
// base real — por eso el candado.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const TEST_EMAILS = new Set([
  "roberto.dev@stailist.app",
  "claude.dev@stailist.app",
  "roberto@playrobix.com",
]);

const email = (process.argv[2] ?? "roberto.dev@stailist.app").trim().toLowerCase();
if (!TEST_EMAILS.has(email)) {
  console.error(
    `✋ "${email}" no está en la allowlist de prueba. Reset abortado (candado).\n` +
      `   Permitidos: ${[...TEST_EMAILS].join(", ")}`
  );
  process.exit(1);
}

const env = readFileSync(".env.local", "utf8");
const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.error("No encontré DATABASE_URL en .env.local (¿corriste desde la raíz del repo?).");
  process.exit(1);
}
const url = line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "");

const c = new Client({ connectionString: url });
await c.connect();

const u = await c.query("select id from auth.users where email = $1", [email]);
if (!u.rows.length) {
  console.error(`No hay usuario con ${email}.`);
  await c.end();
  process.exit(1);
}
const uid = u.rows[0].id;

await c.query("begin");
try {
  // Borrado DURO de los datos por usuario (queremos arranque limpio, no soft
  // delete). Orden: events antes que outfits (events.outfit_id los referencia).
  const ev = await c.query("delete from public.events where user_id = $1", [uid]);
  const ou = await c.query("delete from public.outfits where user_id = $1", [uid]);
  const it = await c.query("delete from public.items where user_id = $1", [uid]);
  const tr = await c.query("delete from public.trips where user_id = $1", [uid]);
  const wi = await c.query("delete from public.wishlist_items where user_id = $1", [uid]);
  const lc = await c.query("delete from public.library_candidates where user_id = $1", [uid]);

  // Perfil de vuelta a fresco. Se conservan id, email, created_at e is_admin;
  // se limpia TODO lo que el onboarding deriva (si queda un dato, se salta ese
  // paso). city también, para que el clima se vuelva a pedir.
  await c.query(
    `update public.profiles set
       onboarding_step = 0,
       gender = null, age_range = null,
       palette_season = null, palette_quiz = null, palette_flow = null,
       last_objective = null, style_archetype = null, avatar_path = null,
       lifestyle = null, capsule_target = null, capsule_match = null, capsule_overrides = null,
       capsule_outfits = null, capsule_outfits_sig = null, capsule_swaps = null,
       body_type = null, body_build = null, body_volume = null,
       style_reference = null, style_questions = null,
       height_cm = null, style_words = null, city = null,
       minor_ack_at = null, minor_parent_email = null, minor_consent_token = null,
       minor_consent_verified_at = null, minor_consent_last_sent_at = null,
       -- columnas NOT NULL: a su default, no null.
       taste_tags = '[]'::jsonb,
       hints_seen = '{}'::jsonb,
       journey_state = '{}'::jsonb,
       style_vetoes = '{"free": [], "chips": []}'::jsonb
     where id = $1`,
    [uid]
  );

  await c.query("commit");
  console.log(`✅ ${email} reseteado a estado 0.`);
  console.log(
    `   borrados → events:${ev.rowCount} outfits:${ou.rowCount} items:${it.rowCount} ` +
      `trips:${tr.rowCount} wishlist:${wi.rowCount} candidates:${lc.rowCount}`
  );
  console.log("   perfil → gender/edad/colorimetría/avatar/clóset/estilo limpios; onboarding_step=0.");
  console.log("   La cuenta y el allowlist se conservan: vuelve a loguear y arranca el flujo desde género.");
} catch (e) {
  await c.query("rollback");
  console.error("Reset falló (rollback, no se tocó nada):", e.message);
  process.exitCode = 1;
}
await c.end();
