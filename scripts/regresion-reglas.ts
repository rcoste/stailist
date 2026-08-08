// ¿ROMPIMOS ALGO QUE YA FUNCIONABA?
//
// Roberto, después de un día entero de cambios: "me preocupa que rompamos algo
// que ya funcionaba bien… los trajes para bodas y así, yo lo hacía bien". La
// preocupación es correcta y no se contesta con palabras: se contesta pasando
// las reglas de ejecución sobre TODOS los looks que el motor ya generó y
// comparando con cómo se comportaban antes.
//
// Qué mide: cuántas violaciones marca cada regla hoy, y cuántas marcaba antes
// del único cambio de hoy que llega al motor — la excepción de `traje-
// desparejado` para las piezas atadas por un `conjunto`. Si los dos números
// coinciden, el cambio es un no-op sobre los datos reales y no puede haber roto
// nada; si difieren, el diff dice exactamente en qué looks.
//
// Correr: npx tsx scripts/regresion-reglas.ts

import pg from "pg";
import { readFileSync } from "node:fs";
import { revisarEjecucion } from "../lib/engine/reglas-ejecucion";
import type { EngineItem } from "../lib/engine/prompt";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
) as Record<string, string>;

async function main() {
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();

const { rows: prendas } = await c.query(
  `select i.id, i.certeza, i.attrs, a.name as arch_name, a.category as arch_cat, a.attrs as arch_attrs
     from items i left join archetypes a on a.id = i.archetype_id
    where i.deleted_at is null`
);
const porId = new Map<string, EngineItem>();
for (const r of prendas) {
  const attrs = (r.attrs ?? {}) as Record<string, unknown>;
  const archAttrs = (r.arch_attrs ?? {}) as Record<string, unknown>;
  porId.set(r.id, {
    id: r.id,
    certeza: r.certeza,
    attrs: {
      ...attrs,
      nombre: (attrs.nombre as string) ?? r.arch_name ?? undefined,
      // Igual que en producción: la categoría del arquetipo cuenta cuando la
      // prenda no la trae (conCategoria de lib/item-image).
      categoria: (attrs.categoria as string) ?? r.arch_cat ?? undefined,
      subtipo: (attrs.subtipo as string) ?? (archAttrs.subtipo as string) ?? undefined,
    },
  } as EngineItem);
}

const { rows: outfits } = await c.query(
  `select id, item_ids from outfits where deleted_at is null and item_ids is not null`
);
await c.end();

/** Cuenta violaciones por regla sobre todos los looks. */
function marcador(quitarElLazo: boolean) {
  const porRegla = new Map<string, number>();
  let looksConAlgo = 0;
  for (const o of outfits) {
    const items = ((o.item_ids as string[]) ?? [])
      .map((id) => porId.get(id))
      .filter((x): x is EngineItem => !!x)
      // Simula el ANTES: sin `conjunto`, la excepción no puede aplicar y la
      // regla se comporta como se comportaba ayer.
      .map((x) => (quitarElLazo ? { ...x, attrs: { ...x.attrs, conjunto: undefined } } : x));
    if (items.length === 0) continue;
    const v = revisarEjecucion(items);
    if (v.length) looksConAlgo++;
    for (const x of v) porRegla.set(x.regla, (porRegla.get(x.regla) ?? 0) + 1);
  }
  return { porRegla, looksConAlgo };
}

const hoy = marcador(false);
const antes = marcador(true);

console.log(`looks reales revisados: ${outfits.length}`);
console.log(`prendas cargadas: ${porId.size}\n`);
console.log("regla                        | antes | hoy | Δ");
console.log("-----------------------------|-------|-----|---");
const reglas = new Set([...antes.porRegla.keys(), ...hoy.porRegla.keys()]);
let diferencias = 0;
for (const r of [...reglas].sort()) {
  const a = antes.porRegla.get(r) ?? 0;
  const h = hoy.porRegla.get(r) ?? 0;
  if (a !== h) diferencias++;
  console.log(`${r.padEnd(28)} | ${String(a).padStart(5)} | ${String(h).padStart(3)} | ${h - a}`);
}
console.log(
  `\nlooks con alguna violación: antes ${antes.looksConAlgo}, hoy ${hoy.looksConAlgo}`
);
console.log(
  diferencias === 0
    ? "\n✅ IDÉNTICO sobre los datos reales: el cambio no altera ningún veredicto."
    : `\n⚠️  ${diferencias} regla(s) cambiaron de conteo — revisar.`
);
}

main();
