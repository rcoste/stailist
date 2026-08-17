// RESETEAR EL RECORRIDO DE UN USUARIO, conservando su cuenta y su acceso.
//
// Lo pidió Alberto para volver a probar el flujo completo desde la primera
// pantalla (2026-08-17). Borra lo que la persona ha CONSTRUIDO —prendas, looks,
// eventos, viajes, wishlist— y devuelve el perfil a su estado inicial, pero NO
// toca la fila del perfil ni el usuario de auth: entra con su magic link de
// siempre y arranca en el onboarding.
//
// LO QUE **NO** SE TOCA, y es a propósito:
//   · `email_semanal` — es una preferencia de comunicación, no parte del
//     recorrido. Si alguien se dio de baja, resetearlo lo re-suscribiría sin su
//     permiso.
//   · `email_unsub_token` — regenerarlo rompería el link de baja que ya viaja
//     en los correos que tiene en su bandeja.
//   · `is_admin`, `created_at`, `email`, `id`.
//
// LOS ARCHIVOS DE STORAGE SÍ SE BORRAN (avatar, fotos, renders, try-ons). Dejar
// el avatar huérfano no es sólo basura: se genera de la foto de su cara, y
// "desde cero" tiene que incluir eso.
//
// ESTO NO SE PUEDE DESHACER. No hay papelera. Pide confirmación con --ejecutar.
//
// Uso:  npx tsx scripts/reset-usuario.ts <correo>              (sólo enseña)
//       npx tsx scripts/reset-usuario.ts <correo> --ejecutar   (borra)
import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

/** Las columnas del perfil que SON el recorrido: vuelven a su estado inicial. */
const A_CERO = `
  taste_tags = '[]'::jsonb,
  palette_season = null, palette_quiz = null, palette_flow = null,
  last_objective = null, onboarding_step = 0, city = null,
  gender = null, style_archetype = null, avatar_path = null,
  lifestyle = null, capsule_target = null, capsule_match = null,
  capsule_overrides = null, capsule_outfits = null, capsule_outfits_sig = null,
  capsule_swaps = null, journey_state = '{}'::jsonb,
  body_type = null, body_build = null, body_volume = null, height_cm = null,
  style_vetoes = '{"free": [], "chips": []}'::jsonb,
  style_reference = null, style_questions = null, style_words = null,
  hints_seen = '{}'::jsonb, age_range = null, fit_pref = null,
  work_dress_code = null,
  minor_ack_at = null, minor_parent_email = null, minor_consent_token = null,
  minor_consent_verified_at = null, minor_consent_last_sent_at = null,
  email_reenganche_sent_at = null, email_semanal_last_sent = null,
  updated_at = now()
`;

async function main() {
  const correo = process.argv[2];
  const ejecutar = process.argv.includes("--ejecutar");
  if (!correo) {
    console.error("Uso: npx tsx scripts/reset-usuario.ts <correo> [--ejecutar]");
    process.exit(1);
  }

  const c = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const perfil = await c.query<{ id: string; avatar_path: string | null }>(
    `select id, avatar_path from profiles where email = $1`,
    [correo]
  );
  if (perfil.rowCount === 0) throw new Error(`no existe el perfil de ${correo}`);
  const uid = perfil.rows[0].id;

  // Los archivos se recogen ANTES de borrar las filas: después ya no hay de
  // dónde sacar las rutas.
  const rutas = new Set<string>();
  if (perfil.rows[0].avatar_path) rutas.add(perfil.rows[0].avatar_path);
  const archivos = await c.query<{ ruta: string }>(
    `select photo_path as ruta from items where user_id = $1 and photo_path is not null
     union select render_path from items where user_id = $1 and render_path is not null
     union select attrs->>'origen_foto' from items where user_id = $1 and attrs->>'origen_foto' is not null
     union select tryon_path from outfits where user_id = $1 and tryon_path is not null
     union select photo_path from outfits where user_id = $1 and photo_path is not null`,
    [uid]
  );
  for (const r of archivos.rows) if (r.ruta) rutas.add(r.ruta);

  const cuenta = async (t: string) =>
    Number(
      (await c.query(`select count(*) n from ${t} where user_id = $1`, [uid])).rows[0].n
    );
  const antes = {
    items: await cuenta("items"),
    outfits: await cuenta("outfits"),
    events: await cuenta("events"),
    trips: await cuenta("trips"),
    wishlist_items: await cuenta("wishlist_items"),
    library_candidates: await cuenta("library_candidates"),
  };

  console.log(`\n${correo}  (${uid})`);
  for (const [t, n] of Object.entries(antes)) console.log(`  ${t.padEnd(20)} ${n}`);
  console.log(`  ${"archivos en Storage".padEnd(20)} ${rutas.size}`);

  if (!ejecutar) {
    console.log("\n(sólo lectura — pásale --ejecutar para borrar)");
    await c.end();
    return;
  }

  // UNA transacción: o se va todo o no se va nada. Un reset a medias deja a la
  // persona con looks que apuntan a prendas que ya no existen.
  try {
    await c.query("begin");
    for (const t of ["events", "outfits", "items", "trips", "wishlist_items", "library_candidates"]) {
      await c.query(`delete from ${t} where user_id = $1`, [uid]);
    }
    await c.query(`update profiles set ${A_CERO} where id = $1`, [uid]);
    await c.query("commit");
    console.log("\n✅ base de datos: borrado y perfil a cero");
  } catch (e) {
    await c.query("rollback");
    throw new Error(`nada se borró (rollback): ${e instanceof Error ? e.message : e}`);
  }

  // Los archivos van DESPUÉS del commit y no bloquean: si Storage falla, la
  // base ya quedó consistente y lo que sobra son archivos huérfanos, no un
  // perfil roto.
  if (rutas.size > 0) {
    const s = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await s.storage.from("prendas").remove(Array.from(rutas));
    console.log(
      error ? `⚠ Storage: ${error.message} (quedan huérfanos)` : `✅ Storage: ${rutas.size} archivos borrados`
    );
  }

  const despues = await c.query<{ onboarding_step: number }>(
    `select onboarding_step from profiles where id = $1`,
    [uid]
  );
  console.log(`\nonboarding_step = ${despues.rows[0].onboarding_step} · su acceso sigue intacto`);
  await c.end();
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
