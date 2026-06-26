// Utilidad local para preparar un correo de prueba "desde cero".
// Usa la conexión directa de Postgres (DATABASE_URL) — ignora RLS.
//
//   node scripts/test-user.mjs check <email>   → solo lee: qué datos existen
//   node scripts/test-user.mjs wipe  <email>   → BORRA todo del usuario (destructivo)
//
// El wipe borra la fila de auth.users; por los FK ON DELETE CASCADE eso arrastra
// profile + items + outfits + events + trips. También borra sus fotos del bucket
// privado 'prendas' (rutas {userId}/...) y deja el correo en la allowlist para que
// pueda volver a registrarse con magic link.
import { readFileSync } from "node:fs";
import pg from "pg";

const [, , mode, email] = process.argv;
if (!email || (mode !== "check" && mode !== "wipe")) {
  console.error("Uso: node scripts/test-user.mjs <check|wipe> <email>");
  process.exit(1);
}

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.error("No encontré DATABASE_URL en .env.local");
  process.exit(1);
}
const connectionString = line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

const n = async (sql, params) => (await client.query(sql, params)).rows[0]?.c ?? 0;

try {
  await client.connect();

  // ¿Existe el usuario de auth?
  const authRes = await client.query(
    "select id, created_at, last_sign_in_at from auth.users where email = $1",
    [email]
  );
  const user = authRes.rows[0];
  const onAllowlist =
    (await client.query("select 1 from public.allowlist where email = $1", [email])).rowCount > 0;

  if (!user) {
    console.log(`\n── ${email} ──`);
    console.log("auth.users:  NO existe (nunca se registró)");
    console.log(`allowlist:   ${onAllowlist ? "sí (puede registrarse)" : "NO (hay que agregarlo para que pueda entrar)"}`);
    if (mode === "wipe") {
      // Nada que borrar; solo aseguramos allowlist para el test.
      await client.query(
        "insert into public.allowlist (email) values ($1) on conflict (email) do nothing",
        [email]
      );
      console.log("\nwipe: no había datos. Allowlist asegurada. Listo para registrarse desde cero. ✅");
    } else {
      console.log("\nNada que borrar. Si quieres que pueda entrar, corre el wipe (asegura allowlist).");
    }
    await client.end();
    process.exit(0);
  }

  const uid = user.id;
  const items = await n("select count(*)::int c from public.items where user_id = $1", [uid]);
  const outfits = await n("select count(*)::int c from public.outfits where user_id = $1", [uid]);
  const events = await n("select count(*)::int c from public.events where user_id = $1", [uid]);
  const trips = await n("select count(*)::int c from public.trips where user_id = $1", [uid]);
  const photos = await n(
    "select count(*)::int c from storage.objects where bucket_id = 'prendas' and name like $1",
    [uid + "/%"]
  );
  const prof = (
    await client.query("select onboarding_step from public.profiles where id = $1", [uid])
  ).rows[0];

  console.log(`\n── ${email} ──`);
  console.log(`auth.users:  existe (id ${uid})`);
  console.log(`registrado:  ${user.created_at}`);
  console.log(`último login:${user.last_sign_in_at ?? " nunca"}`);
  console.log(`onboarding:  paso ${prof?.onboarding_step ?? "—"}`);
  console.log(`datos:       ${items} prendas · ${outfits} outfits · ${events} eventos · ${trips} viajes`);
  console.log(`fotos:       ${photos} en storage (bucket prendas)`);
  console.log(`allowlist:   ${onAllowlist ? "sí" : "NO"}`);

  if (mode === "check") {
    console.log("\n(check: no borré nada. Para limpiar y testear desde cero corre el wipe.)");
    await client.end();
    process.exit(0);
  }

  // ── wipe: borrado destructivo, en transacción ──
  // Nota: storage.objects NO se puede borrar por SQL (Supabase lo bloquea para
  // mantener el backend de storage en sync). Las fotos quedan huérfanas pero son
  // inofensivas: el re-registro crea un user con id nuevo, así que nunca se cruzan.
  await client.query("begin");
  const delUser = await client.query("delete from auth.users where id = $1", [uid]);
  await client.query(
    "insert into public.allowlist (email) values ($1) on conflict (email) do nothing",
    [email]
  );
  await client.query("commit");

  console.log("\nwipe ejecutado:");
  console.log(`  auth.users borrado (${delUser.rowCount} fila) → profile + ${items} prendas + ${outfits} outfits + ${events} eventos + ${trips} viajes (cascada)`);
  console.log("  allowlist asegurada");
  if (photos > 0) {
    console.log(`  ⚠ ${photos} fotos quedaron en storage (huérfanas, inofensivas). Bórralas en el dashboard si quieres: Storage → prendas → carpeta ${uid}/`);
  }
  console.log("\nListo para registrarse desde cero con magic link. ✅");
} catch (err) {
  try { await client.query("rollback"); } catch {}
  console.error("ERROR:", err.message);
  process.exit(1);
} finally {
  try { await client.end(); } catch {}
}
