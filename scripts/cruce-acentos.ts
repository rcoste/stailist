// EL CRUCE DEL EXPERIMENTO DE ACENTOS: ¿la línea de apetito mueve DÓNDE cae el
// color, o el motor la ignora?
//
// Uso:  npx tsx scripts/cruce-acentos.ts <corridaControl> <corridaTratamiento>
//
// POR QUÉ ESTE SCRIPT Y NO EL VOTO. La métrica primaria de este cambio NO
// depende de ningún juez: es aritmética sobre los looks generados —en qué
// clase de prenda cayó el color— así que optimizar contra ella no la corrompe,
// a diferencia de una rúbrica. El voto de Roberto entra como guardia (que la
// discreción no cueste calidad), no como medición del efecto.
//
// PRE-REGISTRADO antes de correr el tratamiento (2026-08-25): con apetito
// "discreto" deben SUBIR los looks cuyo acento vive en pieza chica y BAJAR los
// que lo llevan en pieza grande. Si no se mueve, la línea del prompt no está
// haciendo nada y se reescribe o se tira.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { LookMotor } from "../lib/comparador/motor";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

// Colores que cuentan como ACENTO: vivos, ni neutros ni los básicos de
// guardarropa (marino/beige/café son fondo, no acento).
const SAT =
  /cobalto|azul rey|vino|burdeos|esmeralda|verde bosque|verde botella|verde lima|rojo|rosa|lavanda|amarillo|olivo|oliva|mostaza|coral/;
// Dónde vive: "grande" domina el look; "chica" es el acento del 60-30-10.
const GRANDES = ["top", "bottom", "abrigo", "saco", "vestido"];

async function main() {
  const [control, tratamiento] = process.argv.slice(2);
  if (!control || !tratamiento) {
    console.error("Uso: npx tsx scripts/cruce-acentos.ts <control> <tratamiento>");
    process.exit(1);
  }
  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: users } = await s.auth.admin.listUsers();
  const uid = users.users.find((u) => u.email === "roberto@kublau.com")!.id;
  const { data: items } = await s
    .from("items")
    .select("id, attrs, archetypes(category)")
    .eq("user_id", uid)
    .is("deleted_at", null);
  const M = new Map(
    (items ?? []).map((r) => {
      const attrs = r.attrs as Record<string, unknown>;
      const arq = r.archetypes as { category?: string } | null;
      return [
        r.id as string,
        {
          nombre: (attrs?.nombre as string) ?? "",
          color: ((attrs?.color as string) ?? "").toLowerCase(),
          cat: ((attrs?.categoria as string) ?? arq?.category ?? "").toLowerCase(),
        },
      ];
    })
  );
  const esAcento = (p: { nombre: string; color: string }) =>
    SAT.test(`${p.color} ${p.nombre.toLowerCase()}`);

  // El id completo a partir del prefijo: `like` sobre una columna uuid no
  // matchea (devuelve 0 filas en silencio, que es peor que un error — la
  // primera corrida de este script reportó "la línea no funciona" con las dos
  // muestras vacías).
  const { data: corridas } = await s.from("eval_corridas").select("id");
  const idDe = (prefijo: string) => {
    const hit = (corridas ?? []).find((c) => (c.id as string).startsWith(prefijo));
    if (!hit) throw new Error(`no encontré la corrida ${prefijo}`);
    return hit.id as string;
  };

  async function medir(prefijo: string) {
    const { data: filas } = await s
      .from("eval_briefs")
      .select("looks, notas")
      .eq("corrida_id", idDe(prefijo));
    let looks = 0;
    let soloChico = 0;
    let conGrande = 0;
    let sinAcento = 0;
    let aprob = 0;
    let de = 0;
    for (const f of filas ?? []) {
      const ls = (f.looks as LookMotor[] | null) ?? [];
      const notas = (f.notas as { texto?: { aprobado?: boolean } }[] | null) ?? [];
      ls.forEach((l, i) => {
        looks++;
        const ps = (l.item_ids ?? []).map((id) => M.get(id)).filter(Boolean) as {
          nombre: string;
          color: string;
          cat: string;
        }[];
        const ac = ps.filter(esAcento);
        const grandes = ac.filter((p) => GRANDES.includes(p.cat));
        if (!ac.length) sinAcento++;
        else if (grandes.length) conGrande++;
        else soloChico++;
        const t = notas[i]?.texto;
        if (t) {
          de++;
          if (t.aprobado) aprob++;
        }
      });
    }
    return { looks, sinAcento, soloChico, conGrande, aprob, de };
  }

  const c = await medir(control);
  const t = await medir(tratamiento);
  const pct = (n: number, d: number) => (d ? Math.round((n * 100) / d) : 0);

  console.log(`\nCONTROL ${control}  →  TRATAMIENTO ${tratamiento}\n`);
  console.log(`${"".padEnd(34)}control        tratamiento`);
  const fila = (etq: string, a: number, b: number) =>
    console.log(
      `${etq.padEnd(34)}${String(a).padStart(3)} (${String(pct(a, c.looks)).padStart(2)}%)      ${String(b).padStart(3)} (${String(pct(b, t.looks)).padStart(2)}%)`
    );
  fila("looks", c.looks, t.looks);
  fila("acento SÓLO en pieza chica", c.soloChico, t.soloChico);
  fila("acento en pieza GRANDE", c.conGrande, t.conGrande);
  fila("sin acento (tonal)", c.sinAcento, t.sinAcento);
  console.log(
    `\nguardia — aprobado por el juez de texto: ${pct(c.aprob, c.de)}% → ${pct(t.aprob, t.de)}%`
  );

  const subeChico = pct(t.soloChico, t.looks) > pct(c.soloChico, c.looks);
  const bajaGrande = pct(t.conGrande, t.looks) < pct(c.conGrande, c.looks);
  console.log(
    `\nPRE-REGISTRO: sube el acento chico ${subeChico ? "SÍ" : "NO"} · baja el grande ${bajaGrande ? "SÍ" : "NO"} → ${
      subeChico && bajaGrande ? "la línea FUNCIONA" : "la línea NO mueve lo que debía"
    }`
  );
}

main();
