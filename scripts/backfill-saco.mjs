// Backfill de la categoría "saco": reetiqueta como "saco" las prendas que hoy
// están en "abrigo" pero son sacos/blazers/trajes. Excluye "traje de baño".
// Cubre: items (clóset), archetypes (catálogo), y las cápsulas guardadas en
// profiles.capsule_target y trips.capsule_target (JSON). Al cambiar un target,
// limpia su capsule_match para que se recalcule limpio.
//
// Uso:
//   node scripts/backfill-saco.mjs           (dry-run: solo muestra qué cambiaría)
//   node scripts/backfill-saco.mjs --apply   (aplica los cambios)
import { readFileSync } from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

const url = (() => {
  const line = readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("Falta DATABASE_URL en .env.local");
  return line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
})();

// ¿El nombre/tipo indican un saco? Excluye traje de baño.
function isSaco(...parts) {
  const s = parts.filter(Boolean).join(" ").toLowerCase();
  if (/ba(ñ|n)o|bañador|banador/.test(s)) return false; // traje de baño ≠ saco
  if (/(saco|blazer|smoking|americana|sport ?coat)/.test(s)) return true;
  return /\btraje\b|traje sastre|traje de vestir/.test(s);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
});
await client.connect();

let changed = { items: 0, archetypes: 0, profiles: 0, trips: 0 };

try {
  console.log(APPLY ? "== APLICANDO ==" : "== DRY-RUN (nada se escribe) ==");

  // 1) items del clóset (la categoría vive en attrs.categoria; los items de
  //    arquetipo la heredan de archetypes.category → los cubre el paso 2).
  const items = await client.query(
    "select id, attrs from items where attrs->>'categoria' = 'abrigo' and deleted_at is null"
  );
  for (const r of items.rows) {
    const a = r.attrs ?? {};
    if (isSaco(a.nombre, a.tipo)) {
      console.log(`  item  → saco: ${a.nombre ?? a.tipo ?? r.id}`);
      changed.items++;
      if (APPLY)
        await client.query(
          `update items set attrs = jsonb_set(attrs, '{categoria}', '"saco"'::jsonb) where id = $1`,
          [r.id]
        );
    }
  }

  // 2) archetypes (catálogo)
  const arch = await client.query(
    "select id, slug, name, attrs from archetypes where category = 'abrigo'"
  );
  for (const r of arch.rows) {
    if (isSaco(r.name, r.slug, r.attrs?.tipo)) {
      console.log(`  arquetipo → saco: ${r.name} (${r.slug})`);
      changed.archetypes++;
      if (APPLY) await client.query("update archetypes set category = 'saco' where id = $1", [r.id]);
    }
  }

  // 3) cápsulas guardadas en profiles + trips (JSON)
  async function backfillTarget(table, extraSet) {
    const rows = await client.query(
      `select id, capsule_target from ${table} where capsule_target is not null`
    );
    let n = 0;
    for (const r of rows.rows) {
      const target = r.capsule_target;
      const list = Array.isArray(target?.items) ? target.items : [];
      let touched = false;
      for (const it of list) {
        if (it.category === "abrigo" && isSaco(it.nombre, it.tipo)) {
          it.category = "saco";
          touched = true;
          console.log(`  ${table} ${r.id} → saco: ${it.nombre ?? it.tipo}`);
        }
      }
      if (touched) {
        n++;
        if (APPLY) {
          await client.query(
            `update ${table} set capsule_target = $1, capsule_match = null${extraSet} where id = $2`,
            [target, r.id]
          );
        }
      }
    }
    return n;
  }
  changed.profiles = await backfillTarget("profiles", "");
  changed.trips = await backfillTarget("trips", ", outfits_stale = true");

  console.log("\nResumen:", changed);
  console.log(
    APPLY
      ? "Aplicado. Los usuarios con cápsula recalcularán el match en su próxima visita."
      : "Dry-run. Corre con --apply para escribir."
  );
} finally {
  await client.end();
}
